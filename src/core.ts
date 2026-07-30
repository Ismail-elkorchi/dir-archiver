import { promises as fsPromises } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createArchiveWriter,
  openArchive
} from '@ismail-elkorchi/bytefold';
import type {
  ArchiveAuditReport,
  ArchiveInput,
  ArchiveIssue,
  ArchiveOpenOptions,
  ArchiveReader,
  ArchiveWriterFormat
} from '@ismail-elkorchi/bytefold';
import { DirArchiverError } from './errors.ts';
import type {
  DetectResult,
  ExtractOptions,
  ExtractResult,
  ListEntry,
  ListResult,
  NormalizeOptions,
  NormalizeResult,
  ReadOptions,
  WriteOptions,
  WriteResult
} from './types.ts';

/**
 * Detects an archive format without extracting or listing its contents.
 *
 * This is the lightest-weight way to confirm the container and compression
 * layers before choosing a follow-up operation.
 *
 * @param input Archive bytes, path, URL, stream, or blob to inspect.
 * @param options Format hints and parse controls applied during detection.
 * @returns The resolved archive format and any Bytefold detection metadata.
 */
export const detect = async (input: ArchiveInput, options: ReadOptions = {}): Promise<DetectResult> => {
  const reader = await openArchive(input, toArchiveOpenOptions(options));
  try {
    return {
      format: reader.format,
      detection: reader.detection
    };
  } finally {
    await reader.close();
  }
};

/**
 * Lists archive entries without extracting anything to disk.
 *
 * Each entry is projected into a JSON-safe summary so CLI and API callers can
 * inspect paths, sizes, and link metadata before deciding to extract.
 *
 * @param input Archive bytes, path, URL, stream, or blob to inspect.
 * @param options Format hints and parse controls applied while reading the
 * archive directory.
 * @returns Archive metadata plus the entry summaries visible to callers.
 */
export const list = async (input: ArchiveInput, options: ReadOptions = {}): Promise<ListResult> => {
  const reader = await openArchive(input, toArchiveOpenOptions(options));
  try {
    const entries: ListEntry[] = [];
    for await (const entry of reader.entries()) {
      entries.push({
        format: entry.format,
        name: entry.name,
        sizeInBytes: entry.size.toString(),
        isDirectory: entry.isDirectory,
        isSymlink: entry.isSymlink,
        ...(typeof entry.linkName === 'string' ? { linkName: entry.linkName } : {})
      });
    }
    return {
      format: reader.format,
      detection: reader.detection,
      entries
    };
  } finally {
    await reader.close();
  }
};

/**
 * Audits an archive against the selected Bytefold safety profile.
 *
 * Use this before extraction when you need a report of unsafe paths, link
 * entries, or format-specific concerns without writing files to disk.
 *
 * @param input Archive bytes, path, URL, stream, or blob to audit.
 * @param options Safety profile, limits, and format hints used during the
 * audit pass.
 * @returns The Bytefold audit report for the requested profile.
 */
export const audit = async (
  input: ArchiveInput,
  options: ReadOptions = {}
): Promise<ArchiveAuditReport> => {
  const reader = await openArchive(input, toArchiveOpenOptions(options));
  try {
    return await reader.audit(toAuditOptions(options));
  } finally {
    await reader.close();
  }
};

/**
 * Rewrites an archive into its normalized deterministic representation.
 *
 * Normalization is available only when the opened archive reader exposes
 * Bytefold normalization support. Unsupported formats throw
 * `DIRARCHIVER_NORMALIZE_UNSUPPORTED`.
 *
 * @param input Archive bytes, path, URL, stream, or blob to normalize.
 * @param destination Output archive path that will receive the normalized
 * bytes.
 * @param options Format hints and normalization controls applied during the
 * read and write pass.
 * @returns The source format and Bytefold normalization report.
 * @throws {DirArchiverError} When the selected archive format cannot be
 * normalized by the active runtime.
 */
export const normalize = async (
  input: ArchiveInput,
  destination: string,
  options: NormalizeOptions = {}
): Promise<NormalizeResult> => {
  const destinationPath = path.resolve(destination);
  const inputPath = resolveLocalInputPath(input);
  if (
    inputPath !== undefined
    && await pathsReferToSameFile(inputPath, destinationPath)
  ) {
    throw new TypeError('Normalize input and destination must be different paths.');
  }

  const reader = await openArchive(input, toArchiveOpenOptions(options));
  try {
    const normalizeToWritable = reader.normalizeToWritable?.bind(reader);
    if (normalizeToWritable === undefined) {
      throw new DirArchiverError(
        'DIRARCHIVER_NORMALIZE_UNSUPPORTED',
        `Normalize is unavailable for format "${reader.format}".`
      );
    }

    await ensureParentDirectory(destinationPath);
    const report = await withFileWritable(
      destinationPath,
      (writable) => normalizeToWritable(
        writable,
        toNormalizeOptions(options)
      )
    );
    return {
      format: reader.format,
      report
    };
  } finally {
    await reader.close();
  }
};

/**
 * Extracts an archive into a destination directory with safety enforcement.
 *
 * `extract()` defaults to `safetyProfile: 'strict'`. It audits before bytes are
 * written and rejects a report that does not satisfy the selected profile.
 *
 * @param input Archive bytes, path, URL, stream, or blob to extract.
 * @param destination Directory that will receive extracted files.
 * @param options Extraction policy, safety profile, and resource limits.
 * @returns A summary of what was extracted, skipped, and flagged.
 * @throws {DirArchiverError} When audit checks fail, resource limits are
 * exceeded, or unsupported entry types are encountered.
 */
export const extract = async (
  input: ArchiveInput,
  destination: string,
  options: ExtractOptions = {}
): Promise<ExtractResult> => {
  validateMaterializationLimit(
    'maxExtractedFileBytes',
    options.maxExtractedFileBytes
  );
  validateMaterializationLimit(
    'maxTotalExtractedBytes',
    options.maxTotalExtractedBytes
  );

  const reader = await openArchive(input, toArchiveOpenOptions({
    ...options,
    safetyProfile: options.safetyProfile ?? 'strict'
  }));
  try {
    const destinationRoot = path.resolve(destination);
    const auditReport = await reader.audit(toAuditOptions(options));
    if (!auditReport.isSafe) {
      const hasTraversalIssue = auditReport.issues.some(isTraversalIssue);
      throw new DirArchiverError(
        hasTraversalIssue ? 'DIRARCHIVER_PATH_TRAVERSAL' : 'DIRARCHIVER_UNSUPPORTED_ENTRY',
        'Archive does not satisfy the selected safety profile.',
        {
          context: {
            issues: auditReport.issues
          }
        }
      );
    }

    await fsPromises.mkdir(destinationRoot, { recursive: true });

    let extractedFileCount = 0;
    let extractedDirectoryCount = 0;
    let extractedSymlinkCount = 0;
    let skippedEntryCount = 0;
    let totalExtractedBytes = 0;

    for await (const entry of reader.entries()) {
      const destinationPath = resolveEntryDestination(
        destinationRoot,
        entry.name,
        entry.isDirectory
      );

      if (entry.isDirectory) {
        await fsPromises.mkdir(destinationPath, { recursive: true });
        extractedDirectoryCount += 1;
        continue;
      }

      if (entry.isSymlink) {
        if (options.allowSymlinks !== true) {
          skippedEntryCount += 1;
          continue;
        }
        if (typeof entry.linkName !== 'string' || entry.linkName.length === 0) {
          throw new DirArchiverError(
            'DIRARCHIVER_UNSUPPORTED_ENTRY',
            `Symlink "${entry.name}" is missing a link target.`
          );
        }
        const symlinkTarget = normalizeSymlinkTarget(entry.linkName);
        await ensureParentDirectory(destinationPath);
        await fsPromises.symlink(symlinkTarget, destinationPath);
        extractedSymlinkCount += 1;
        continue;
      }

      if (typeof entry.linkName === 'string' && entry.linkName.length > 0) {
        throw new DirArchiverError(
          'DIRARCHIVER_UNSUPPORTED_ENTRY',
          `Hard link entry "${entry.name}" is not supported.`
        );
      }

      const stream = await entry.open();
      const bytes = await readAllBytes(
        stream,
        options.maxExtractedFileBytes,
        options.maxTotalExtractedBytes,
        totalExtractedBytes
      );
      totalExtractedBytes += bytes.length;

      await ensureParentDirectory(destinationPath);
      await fsPromises.writeFile(destinationPath, bytes);
      extractedFileCount += 1;
    }

    return {
      format: reader.format,
      destination: destinationRoot,
      extractedFileCount,
      extractedDirectoryCount,
      extractedSymlinkCount,
      skippedEntryCount,
      issues: auditReport.issues
    };
  } finally {
    await reader.close();
  }
};

/**
 * Writes an archive from a file or directory source path.
 *
 * Directory sources are traversed deterministically and emitted through one
 * of Bytefold's archive writers.
 *
 * @param source File or directory path to archive.
 * @param destination Output archive path.
 * @param options Format selection, traversal rules, and exclusion controls.
 * @returns A summary of the emitted archive format and entry count.
 */
export const write = async (
  source: string,
  destination: string,
  options: WriteOptions = {}
): Promise<WriteResult> => {
  const sourcePath = path.resolve(source);
  const destinationPath = path.resolve(destination);
  if (await pathsReferToSameFile(sourcePath, destinationPath)) {
    throw new TypeError('Archive source and destination must be different paths.');
  }
  const requestedFormat = options.format ?? inferFormatFromDestination(destinationPath) ?? 'zip';
  const sourceStats = options.followSymlinks === true
    ? await fsPromises.stat(sourcePath)
    : await fsPromises.lstat(sourcePath);
  if (!sourceStats.isDirectory() && !sourceStats.isFile()) {
    throw new TypeError('Archive source must be a regular file or directory.');
  }
  const sourceIsDirectory = sourceStats.isDirectory();
  const entries = sourceIsDirectory
    ? await collectDirectoryEntries(sourcePath, destinationPath, options)
    : [{
      sourcePath,
      archivePath: path.basename(sourcePath).replace(/\\/g, '/')
    }];

  await ensureParentDirectory(destinationPath);
  await withFileWritable(destinationPath, async (writable) => {
    const writer = createArchiveWriter(requestedFormat, writable);
    try {
      for (const entry of entries) {
        const bytes = await fsPromises.readFile(entry.sourcePath);
        await writer.add(entry.archivePath, bytes);
      }
      await writer.close();
    } catch (error) {
      await writer.abort(error);
      throw error;
    }
  });

  return {
    format: requestedFormat,
    source: sourcePath,
    destination: destinationPath,
    entryCount: entries.length
  };
};

type PendingEntry = {
  sourcePath: string;
  archivePath: string;
};

const collectDirectoryEntries = async (
  sourcePath: string,
  destinationPath: string,
  options: WriteOptions
): Promise<PendingEntry[]> => {
  const includeBaseDirectory = options.includeBaseDirectory === true;
  const followSymlinks = options.followSymlinks === true;
  const sourceBaseName = path.basename(sourcePath);
  const isExcluded = createExcludePredicate(options.exclude ?? []);
  const visitedDirectories = new Set<string>();
  const toVisit: string[] = [sourcePath];
  const files: PendingEntry[] = [];

  for (const nextDirectory of toVisit) {
    if (followSymlinks) {
      const real = await fsPromises.realpath(nextDirectory);
      if (visitedDirectories.has(real)) {
        continue;
      }
      visitedDirectories.add(real);
    }

    const directoryEntries = await fsPromises.readdir(nextDirectory, { withFileTypes: true });
    directoryEntries.sort((left, right) => compareText(left.name, right.name));

    for (const entry of directoryEntries) {
      const sourceEntryPath = path.join(nextDirectory, entry.name);
      const relativePath = path.relative(sourcePath, sourceEntryPath);

      if (arePathsLexicallyEqual(sourceEntryPath, destinationPath)) {
        continue;
      }

      if (isExcluded(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        toVisit.push(sourceEntryPath);
        continue;
      }

      if (entry.isFile()) {
        files.push({
          sourcePath: sourceEntryPath,
          archivePath: toArchivePath(relativePath, includeBaseDirectory ? sourceBaseName : undefined)
        });
        continue;
      }

      if (!entry.isSymbolicLink() || !followSymlinks) {
        continue;
      }

      const stats = await fsPromises.stat(sourceEntryPath);
      if (stats.isDirectory()) {
        toVisit.push(sourceEntryPath);
      } else if (stats.isFile()) {
        files.push({
          sourcePath: sourceEntryPath,
          archivePath: toArchivePath(relativePath, includeBaseDirectory ? sourceBaseName : undefined)
        });
      }
    }
  }

  files.sort((left, right) => compareText(left.archivePath, right.archivePath));
  return files;
};

const toAuditOptions = (
  options: ReadOptions
): Parameters<ArchiveReader['audit']>[0] => {
  return {
    ...(options.limits === undefined ? {} : { limits: options.limits }),
    ...(options.signal === undefined ? {} : { signal: options.signal })
  };
};

const toNormalizeOptions = (
  options: NormalizeOptions
): Parameters<NonNullable<ArchiveReader['normalizeToWritable']>>[1] => {
  return {
    isDeterministic: options.isDeterministic ?? true,
    ...(options.limits === undefined ? {} : { limits: options.limits }),
    ...(options.signal === undefined ? {} : { signal: options.signal })
  };
};

const toArchiveOpenOptions = (
  options: ReadOptions
): ArchiveOpenOptions => ({
  ...(options.format === undefined ? {} : { format: options.format }),
  ...(options.safetyProfile === undefined
    ? {}
    : { safetyProfile: options.safetyProfile }),
  ...(options.limits === undefined ? {} : { limits: options.limits }),
  ...(options.signal === undefined ? {} : { signal: options.signal }),
  ...(options.password === undefined ? {} : { password: options.password }),
  ...(options.filename === undefined ? {} : { filename: options.filename })
});

const createExcludePredicate = (
  excludes: readonly string[]
): ((relativePath: string) => boolean) => {
  const excludedPaths = new Set<string>();
  const excludedNames = new Set<string>();
  const caseInsensitive = process.platform === 'win32';

  for (const rawExclude of excludes) {
    const portableExclude = rawExclude.replace(/\\/g, '/');
    const isWindowsAbsolutePath = /^[a-zA-Z]:[\\/]/u.test(rawExclude);
    const hasParentComponent = portableExclude
      .split('/')
      .some((component) => component === '..');
    const hasSeparator = portableExclude.includes('/');
    const normalizedExclude = path.normalize(
      portableExclude.replace(/\//g, path.sep)
    );
    if (
      rawExclude.length === 0
      || normalizedExclude === '.'
      || hasParentComponent
      || isWindowsAbsolutePath
      || path.isAbsolute(normalizedExclude)
    ) {
      throw new TypeError(
        'Each exclusion must be a non-empty source-relative basename or path.'
      );
    }
    const sourceRelativePath = normalizedExclude.endsWith(path.sep)
      ? normalizedExclude.slice(0, -1)
      : normalizedExclude;
    const normalizedValue = normalizeCase(sourceRelativePath, caseInsensitive);
    excludedPaths.add(normalizedValue);
    if (!hasSeparator) {
      excludedNames.add(normalizedValue);
    }
  }

  return (relativePath: string): boolean => {
    const normalizedRelativePath = normalizeCase(
      path.normalize(relativePath),
      caseInsensitive
    );
    if (excludedPaths.has(normalizedRelativePath)) {
      return true;
    }
    const baseName = normalizeCase(
      path.basename(normalizedRelativePath),
      caseInsensitive
    );
    return excludedNames.has(baseName);
  };
};

const normalizeCase = (value: string, caseInsensitive: boolean): string => {
  return caseInsensitive ? value.toLowerCase() : value;
};

const compareText = (left: string, right: string): number => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const isTraversalIssue = (issue: ArchiveIssue): boolean => {
  switch (issue.code) {
    case 'ARCHIVE_PATH_TRAVERSAL':
    case 'TAR_PATH_TRAVERSAL':
    case 'ZIP_PATH_TRAVERSAL':
      return true;
    default:
      return false;
  }
};

const arePathsLexicallyEqual = (left: string, right: string): boolean =>
  normalizeCase(path.resolve(left), process.platform === 'win32')
  === normalizeCase(path.resolve(right), process.platform === 'win32');

const pathsReferToSameFile = async (
  left: string,
  right: string
): Promise<boolean> => {
  if (arePathsLexicallyEqual(left, right)) {
    return true;
  }

  try {
    const [leftStats, rightStats] = await Promise.all([
      fsPromises.stat(left),
      fsPromises.stat(right)
    ]);
    return leftStats.dev === rightStats.dev && leftStats.ino === rightStats.ino;
  } catch (error) {
    if (isMissingPathError(error)) {
      return false;
    }
    throw error;
  }
};

const toArchivePath = (relativePath: string, baseDirectory?: string): string => {
  const normalized = relativePath.replace(/\\/g, '/');
  if (baseDirectory) {
    return path.posix.join(baseDirectory, normalized);
  }
  return normalized;
};

const normalizeArchiveEntryName = (entryName: string): string => {
  const normalizedSlashes = entryName.replace(/\\/g, '/');
  if (normalizedSlashes.length === 0) {
    throw new DirArchiverError('DIRARCHIVER_PATH_TRAVERSAL', 'Archive entry name is empty.');
  }
  if (normalizedSlashes.startsWith('/') || /^[a-zA-Z]:\//u.test(normalizedSlashes)) {
    throw new DirArchiverError(
      'DIRARCHIVER_PATH_TRAVERSAL',
      `Archive entry "${entryName}" is absolute and cannot be extracted safely.`
    );
  }
  const parts = normalizedSlashes.split('/').filter((part) => part.length > 0 && part !== '.');
  if (parts.some((part) => part === '..')) {
    throw new DirArchiverError(
      'DIRARCHIVER_PATH_TRAVERSAL',
      `Archive entry "${entryName}" escapes extraction root.`
    );
  }
  return parts.join('/');
};

const resolveEntryDestination = (
  destinationRoot: string,
  entryName: string,
  entryIsDirectory: boolean
): string => {
  const safeRelative = normalizeArchiveEntryName(entryName);
  if (safeRelative.length === 0 && !entryIsDirectory) {
    throw new DirArchiverError(
      'DIRARCHIVER_UNSUPPORTED_ENTRY',
      `Non-directory archive entry "${entryName}" resolves to the extraction root.`
    );
  }
  const resolved = path.resolve(destinationRoot, safeRelative);
  if (resolved !== destinationRoot && !resolved.startsWith(`${destinationRoot}${path.sep}`)) {
    throw new DirArchiverError(
      'DIRARCHIVER_PATH_TRAVERSAL',
      `Archive entry "${entryName}" resolves outside destination root.`
    );
  }
  return resolved;
};

const normalizeSymlinkTarget = (linkName: string): string => {
  const normalized = linkName.replace(/\\/g, '/');
  if (normalized.startsWith('/') || /^[a-zA-Z]:\//u.test(normalized)) {
    throw new DirArchiverError(
      'DIRARCHIVER_PATH_TRAVERSAL',
      `Symlink target "${linkName}" is absolute and not allowed.`
    );
  }
  const parts = normalized.split('/').filter((part) => part.length > 0 && part !== '.');
  if (parts.some((part) => part === '..')) {
    throw new DirArchiverError(
      'DIRARCHIVER_PATH_TRAVERSAL',
      `Symlink target "${linkName}" escapes extraction root.`
    );
  }
  return parts.length === 0 ? '.' : parts.join('/');
};

const readAllBytes = async (
  stream: ReadableStream<Uint8Array>,
  maxExtractedFileBytes: number | undefined,
  maxTotalExtractedBytes: number | undefined,
  previouslyExtractedBytes: number
): Promise<Uint8Array> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let entryTotal = 0;

  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      entryTotal += chunk.value.length;
      if (
        typeof maxExtractedFileBytes === 'number'
        && entryTotal > maxExtractedFileBytes
      ) {
        throw new DirArchiverError(
          'DIRARCHIVER_RESOURCE_LIMIT',
          `File exceeds maxExtractedFileBytes (${maxExtractedFileBytes}).`,
          {
            context: {
              maxExtractedFileBytes,
              actualExtractedFileBytes: entryTotal
            }
          }
        );
      }
      const projectedTotal = previouslyExtractedBytes + entryTotal;
      if (
        typeof maxTotalExtractedBytes === 'number'
        && projectedTotal > maxTotalExtractedBytes
      ) {
        throw new DirArchiverError(
          'DIRARCHIVER_RESOURCE_LIMIT',
          `Extraction exceeds maxTotalExtractedBytes (${maxTotalExtractedBytes}).`,
          {
            context: {
              maxTotalExtractedBytes,
              projectedTotalBytes: projectedTotal
            }
          }
        );
      }
      chunks.push(chunk.value);
    }
  } catch (error) {
    await reader.cancel(error);
    throw error;
  } finally {
    reader.releaseLock();
  }

  const output = new Uint8Array(entryTotal);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
};

const validateMaterializationLimit = (
  name: 'maxExtractedFileBytes' | 'maxTotalExtractedBytes',
  value: number | undefined
): void => {
  if (value === undefined) return;
  if (Number.isSafeInteger(value) && value >= 0) return;
  throw new TypeError(`${name} must be a non-negative safe integer.`);
};

const resolveLocalInputPath = (input: ArchiveInput): string | undefined => {
  if (input instanceof URL) {
    return input.protocol === 'file:' ? fileURLToPath(input) : undefined;
  }
  if (typeof input !== 'string') return undefined;
  if (/^https?:\/\//iu.test(input)) return undefined;
  return path.resolve(input);
};

const ensureParentDirectory = async (targetPath: string): Promise<void> => {
  await fsPromises.mkdir(path.dirname(targetPath), { recursive: true });
};

type FileWritable = {
  writable: WritableStream<Uint8Array>;
  close: () => Promise<void>;
};

const openFileWritable = async (targetPath: string): Promise<FileWritable> => {
  const file = await fsPromises.open(targetPath, 'w');
  let isClosed = false;

  const closeFile = async (): Promise<void> => {
    if (isClosed) return;
    isClosed = true;
    await file.close();
  };

  return {
    writable: new WritableStream<Uint8Array>({
      write: (chunk) => file.writeFile(chunk),
      close: closeFile,
      abort: closeFile
    }),
    close: closeFile
  };
};

const withFileWritable = async <Result>(
  targetPath: string,
  useWritable: (
    writable: WritableStream<Uint8Array>
  ) => Promise<Result>
): Promise<Result> => {
  const fileWritable = await openFileWritable(targetPath);
  try {
    return await useWritable(fileWritable.writable);
  } finally {
    await fileWritable.close();
  }
};

const inferFormatFromDestination = (destinationPath: string): ArchiveWriterFormat | undefined => {
  const lower = destinationPath.toLowerCase();
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) return 'tar.gz';
  if (lower.endsWith('.tar.zst')) return 'tar.zst';
  if (lower.endsWith('.tar.br')) return 'tar.br';
  if (lower.endsWith('.tar')) return 'tar';
  if (lower.endsWith('.zip')) return 'zip';
  return undefined;
};

const isMissingPathError = (error: unknown): boolean =>
  typeof error === 'object'
  && error !== null
  && 'code' in error
  && error.code === 'ENOENT';
