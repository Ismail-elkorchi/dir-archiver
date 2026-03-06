import {
  createReadStream,
  createWriteStream,
  existsSync,
  promises as fsPromises,
  statSync
} from 'node:fs';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import type {
  ArchiveAuditReport,
  ArchiveFormat,
  ArchiveIssue,
  ArchiveOpenOptions,
  ArchiveReader,
  ArchiveWriter
} from '@ismail-elkorchi/bytefold';
import { DirArchiverError } from './errors.js';
import { loadRuntimeBindings } from './runtime/index.js';
import type {
  DetectResult,
  DirArchiverInput,
  ExtractOptions,
  ExtractResult,
  ListEntry,
  ListResult,
  NormalizeOptions,
  NormalizeResult,
  OpenOptions,
  WriteOptions,
  WriteResult
} from './types.js';

const DIRECTORY_TO_SINGLE_FILE_CODEC = {
  gz: 'tar.gz',
  bz2: 'tar.bz2',
  xz: 'tar.xz',
  zst: 'tar.zst',
  br: 'tar.br'
} as const satisfies Partial<Record<ArchiveFormat, ArchiveFormat>>;

const writeUnsupportedFormats = new Set<ArchiveFormat>(['tar.bz2', 'bz2', 'tar.xz', 'xz']);

/**
 * Opens an archive and returns the live bytefold reader.
 *
 * Use this when you need direct access to low-level reader capabilities such
 * as `entries()`, `audit()`, or normalization support checks. The returned
 * reader is not auto-disposed, so callers should close or dispose it when the
 * active runtime exposes a cleanup hook.
 *
 * @param input Archive bytes, path, URL, stream, or blob to open.
 * @param options Format hints, safety profile, limits, and cancellation
 * signal forwarded to bytefold.
 * @returns A live `ArchiveReader` for advanced inspection flows.
 */
export const open = async (input: DirArchiverInput, options: OpenOptions = {}): Promise<ArchiveReader> => {
  const runtime = await loadRuntimeBindings();
  return runtime.openArchive(input, toArchiveOpenOptions(options));
};

/**
 * Detects an archive format without extracting or listing its contents.
 *
 * This is the lightest-weight way to confirm the container and compression
 * layers before choosing a follow-up operation.
 *
 * @param input Archive bytes, path, URL, stream, or blob to inspect.
 * @param options Format hints and parse controls applied during detection.
 * @returns The resolved archive format and any bytefold detection metadata.
 */
export const detect = async (input: DirArchiverInput, options: OpenOptions = {}): Promise<DetectResult> => {
  const reader = await open(input, options);
  try {
    return {
      format: reader.format,
      detection: reader.detection
    };
  } finally {
    await disposeArchiveReader(reader);
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
export const list = async (input: DirArchiverInput, options: OpenOptions = {}): Promise<ListResult> => {
  const reader = await open(input, options);
  try {
    const entries: ListEntry[] = [];
    for await (const entry of reader.entries()) {
      entries.push({
        format: entry.format,
        name: entry.name,
        size: entry.size.toString(),
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
    await disposeArchiveReader(reader);
  }
};

/**
 * Audits an archive against the selected bytefold safety profile.
 *
 * Use this before extraction when you need a report of unsafe paths, link
 * entries, or format-specific concerns without writing files to disk.
 *
 * @param input Archive bytes, path, URL, stream, or blob to audit.
 * @param options Safety profile, limits, and format hints used during the
 * audit pass.
 * @returns The bytefold audit report for the requested profile.
 */
export const audit = async (
  input: DirArchiverInput,
  options: OpenOptions = {}
): Promise<ArchiveAuditReport> => {
  const reader = await open(input, options);
  try {
    return await reader.audit(toAuditOptions(options));
  } finally {
    await disposeArchiveReader(reader);
  }
};

/**
 * Rewrites an archive into its normalized deterministic representation.
 *
 * Normalization is available only when the opened archive reader exposes
 * bytefold normalization support. Unsupported formats throw
 * `DIRARCHIVER_NORMALIZE_UNSUPPORTED`.
 *
 * @param input Archive bytes, path, URL, stream, or blob to normalize.
 * @param destination Output archive path that will receive the normalized
 * bytes.
 * @param options Format hints and normalization controls applied during the
 * read and write pass.
 * @returns The source format and bytefold normalization report.
 * @throws {DirArchiverError} When the selected archive format cannot be
 * normalized by the active runtime.
 */
export const normalize = async (
  input: DirArchiverInput,
  destination: string,
  options: NormalizeOptions = {}
): Promise<NormalizeResult> => {
  const reader = await open(input, options);
  try {
    if (typeof reader.normalizeToWritable !== 'function') {
      throw new DirArchiverError(
        'DIRARCHIVER_NORMALIZE_UNSUPPORTED',
        `Normalize is unavailable for format "${reader.format}".`
      );
    }

    const destinationPath = path.resolve(destination);
    await ensureParentDirectory(destinationPath);
    const writable = createFileWritable(destinationPath);
    const report = await reader.normalizeToWritable(
      writable,
      toNormalizeOptions(options)
    );
    return {
      format: reader.format,
      report
    };
  } finally {
    await disposeArchiveReader(reader);
  }
};

/**
 * Extracts an archive into a destination directory with safety enforcement.
 *
 * `extract()` defaults to `profile: 'strict'`. Under `strict` or `agent`, the
 * archive is audited before bytes are written to disk and unsafe entries raise
 * a `DirArchiverError` instead of being silently materialized.
 *
 * @param input Archive bytes, path, URL, stream, or blob to extract.
 * @param destination Directory that will receive extracted files.
 * @param options Extraction policy, safety profile, and resource limits.
 * @returns A summary of what was extracted, skipped, and flagged.
 * @throws {DirArchiverError} When audit checks fail, resource limits are
 * exceeded, or unsupported entry types are encountered.
 */
export const extract = async (
  input: DirArchiverInput,
  destination: string,
  options: ExtractOptions = {}
): Promise<ExtractResult> => {
  const reader = await open(input, options);
  try {
    const profile = options.profile ?? 'strict';
    const issues: ArchiveIssue[] = [];
    const destinationRoot = path.resolve(destination);

    await fsPromises.mkdir(destinationRoot, { recursive: true });

    if (profile !== 'compat') {
      if (profile === 'agent') {
        try {
          await reader.assertSafe(toAuditOptions({
            ...options,
            profile
          }));
        } catch (error) {
          throw new DirArchiverError(
            'DIRARCHIVER_UNSUPPORTED_ENTRY',
            'Archive assertSafe failed under agent safety profile.',
            { cause: error }
          );
        }
      }

      const auditReport = await reader.audit(
        toAuditOptions({
          ...options,
          profile
        })
      );
      if (!auditReport.ok) {
        const hasTraversalIssue = auditReport.issues.some((issue) =>
          issue.code.includes('TRAVERSAL')
          || issue.code.includes('ABSOLUTE')
        );
        throw new DirArchiverError(
          hasTraversalIssue ? 'DIRARCHIVER_PATH_TRAVERSAL' : 'DIRARCHIVER_UNSUPPORTED_ENTRY',
          'Archive audit failed under strict safety profile.',
          {
            context: {
              issues: auditReport.issues
            }
          }
        );
      }
      issues.push(...auditReport.issues);
    }

    let extractedFiles = 0;
    let extractedDirectories = 0;
    let skippedEntries = 0;
    let totalExtractedBytes = 0;

    for await (const entry of reader.entries()) {
      const destinationPath = resolveEntryDestination(destinationRoot, entry.name);

      if (entry.isDirectory) {
        await fsPromises.mkdir(destinationPath, { recursive: true });
        extractedDirectories += 1;
        continue;
      }

      if (entry.isSymlink) {
        if (options.allowSymlinks !== true) {
          skippedEntries += 1;
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
        continue;
      }

      if (typeof entry.linkName === 'string' && entry.linkName.length > 0) {
        throw new DirArchiverError(
          'DIRARCHIVER_UNSUPPORTED_ENTRY',
          `Hard link entry "${entry.name}" is not supported by dir-archiver v3.`
        );
      }

      const stream = await entry.open();
      const bytes = await readAllBytes(stream, options.maxEntryBytes, options.maxTotalExtractedBytes, totalExtractedBytes);
      totalExtractedBytes += bytes.length;

      await ensureParentDirectory(destinationPath);
      await fsPromises.writeFile(destinationPath, bytes);
      extractedFiles += 1;
    }

    return {
      format: reader.format,
      destination: destinationRoot,
      extractedFiles,
      extractedDirectories,
      skippedEntries,
      issues
    };
  } finally {
    await disposeArchiveReader(reader);
  }
};

/**
 * Writes an archive from a file or directory source path.
 *
 * Directory sources are traversed deterministically. When callers request a
 * single-file compression codec such as `gz` for a directory source,
 * `dir-archiver` wraps the directory in the corresponding tar-based container
 * (`tar.gz`, `tar.zst`, and so on).
 *
 * @param source File or directory path to archive.
 * @param destination Output archive path.
 * @param options Format selection, traversal rules, and exclusion controls.
 * @returns A summary of the emitted archive format and entry count.
 * @throws {DirArchiverError} When the requested output format is unsupported by
 * the active bytefold writer.
 */
export const write = async (
  source: string,
  destination: string,
  options: WriteOptions = {}
): Promise<WriteResult> => {
  const runtime = await loadRuntimeBindings();
  const sourcePath = path.resolve(source);
  const destinationPath = path.resolve(destination);
  const requestedFormat = options.format ?? inferFormatFromDestination(destinationPath) ?? 'zip';
  const sourceStats = await fsPromises.lstat(sourcePath);
  const sourceIsDirectory = sourceStats.isDirectory();
  const wrappedFormat = sourceIsDirectory
    ? DIRECTORY_TO_SINGLE_FILE_CODEC[requestedFormat as keyof typeof DIRECTORY_TO_SINGLE_FILE_CODEC]
    : undefined;
  const wrappedDirectoryCodec = typeof wrappedFormat === 'string';
  const outputFormat = wrappedFormat ?? requestedFormat;

  if (writeUnsupportedFormats.has(outputFormat)) {
    throw new DirArchiverError(
      'DIRARCHIVER_UNSUPPORTED_ENTRY',
      `Write format "${outputFormat}" is unsupported by bytefold writers.`
    );
  }

  await ensureParentDirectory(destinationPath);

  const writer = runtime.createArchiveWriter(
    outputFormat,
    createFileWritable(destinationPath)
  ) as ArchiveWriter;

  const entries = sourceIsDirectory
    ? await collectDirectoryEntries(sourcePath, options)
    : [{
      sourcePath,
      archivePath: path.basename(sourcePath).replace(/\\/g, '/')
    }];

  for (const entry of entries) {
    const bytes = await fsPromises.readFile(entry.sourcePath);
    await writer.add(entry.archivePath, bytes);
  }
  await writer.close();

  return {
    format: outputFormat,
    source: sourcePath,
    destination: destinationPath,
    entryCount: entries.length,
    wrappedDirectoryCodec
  };
};

interface PendingEntry {
  sourcePath: string;
  archivePath: string;
}

interface ExcludeMatcher {
  isExcluded: (relativePath: string) => boolean;
}

const collectDirectoryEntries = async (
  sourcePath: string,
  options: WriteOptions
): Promise<PendingEntry[]> => {
  const includeBaseDirectory = options.includeBaseDirectory === true;
  const followSymlinks = options.followSymlinks === true;
  const sourceBaseName = path.basename(sourcePath);
  const excludeMatcher = createExcludeMatcher(sourcePath, options.exclude ?? []);
  const visitedDirectories = new Set<string>();
  const toVisit: string[] = [sourcePath];
  const files: PendingEntry[] = [];

  while (toVisit.length > 0) {
    const nextDirectory = toVisit.pop();
    if (!nextDirectory) {
      continue;
    }

    if (followSymlinks) {
      const real = await fsPromises.realpath(nextDirectory).catch(() => null);
      if (!real || visitedDirectories.has(real)) {
        continue;
      }
      visitedDirectories.add(real);
    }

    const directoryEntries = await fsPromises.readdir(nextDirectory, { withFileTypes: true });
    directoryEntries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of directoryEntries) {
      const sourceEntryPath = path.join(nextDirectory, entry.name);
      const relativePath = path.relative(sourcePath, sourceEntryPath);

      if (excludeMatcher.isExcluded(relativePath)) {
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

      const stats = await fsPromises.stat(sourceEntryPath).catch(() => null);
      if (!stats) {
        continue;
      }
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

  files.sort((left, right) => left.archivePath.localeCompare(right.archivePath));
  return files;
};

const toArchiveOpenOptions = (options: OpenOptions): ArchiveOpenOptions => {
  const archiveOptions: ArchiveOpenOptions = {};
  if (options.format !== undefined) {
    archiveOptions.format = options.format;
  }
  if (options.profile !== undefined) {
    archiveOptions.profile = options.profile;
  }
  if (options.isStrict !== undefined) {
    archiveOptions.isStrict = options.isStrict;
  }
  if (options.limits !== undefined) {
    archiveOptions.limits = options.limits;
  }
  if (options.signal !== undefined) {
    archiveOptions.signal = options.signal;
  }
  if (options.password !== undefined) {
    archiveOptions.password = options.password;
  }
  if (options.filename !== undefined) {
    archiveOptions.filename = options.filename;
  }
  return archiveOptions;
};

const toAuditOptions = (
  options: OpenOptions
): Parameters<ArchiveReader['audit']>[0] => {
  const auditOptions: {
    profile?: OpenOptions['profile'];
    isStrict?: OpenOptions['isStrict'];
    limits?: OpenOptions['limits'];
    signal?: OpenOptions['signal'];
  } = {};
  if (options.profile !== undefined) {
    auditOptions.profile = options.profile;
  }
  if (options.isStrict !== undefined) {
    auditOptions.isStrict = options.isStrict;
  }
  if (options.limits !== undefined) {
    auditOptions.limits = options.limits;
  }
  if (options.signal !== undefined) {
    auditOptions.signal = options.signal;
  }
  return auditOptions as Parameters<ArchiveReader['audit']>[0];
};

const toNormalizeOptions = (
  options: NormalizeOptions
): Parameters<NonNullable<ArchiveReader['normalizeToWritable']>>[1] => {
  const normalizeOptions: {
    isDeterministic: boolean;
    limits?: NormalizeOptions['limits'];
    signal?: NormalizeOptions['signal'];
  } = {
    isDeterministic: options.deterministic ?? true
  };
  if (options.limits !== undefined) {
    normalizeOptions.limits = options.limits;
  }
  if (options.signal !== undefined) {
    normalizeOptions.signal = options.signal;
  }
  return normalizeOptions as Parameters<NonNullable<ArchiveReader['normalizeToWritable']>>[1];
};

const createExcludeMatcher = (sourcePath: string, excludes: string[]): ExcludeMatcher => {
  const excludedPaths = new Set<string>();
  const excludedNames = new Set<string>();
  const caseInsensitive = process.platform === 'win32';

  for (const rawExclude of excludes) {
    const normalizedExclude = normalizeExcludeInput(rawExclude, sourcePath);
    if (!normalizedExclude) {
      continue;
    }
    const hasSeparator = normalizedExclude.includes('/') || normalizedExclude.includes('\\') || normalizedExclude.includes(path.sep);
    const normalizedValue = normalizeCase(normalizedExclude, caseInsensitive);
    excludedPaths.add(normalizedValue);
    if (!hasSeparator) {
      excludedNames.add(normalizedValue);
    }
  }

  return {
    isExcluded(relativePath: string): boolean {
      const normalizedRelativePath = normalizeCase(path.normalize(relativePath), caseInsensitive);
      if (excludedPaths.has(normalizedRelativePath)) {
        return true;
      }
      const baseName = normalizeCase(path.basename(normalizedRelativePath), caseInsensitive);
      return excludedNames.has(baseName);
    }
  };
};

const normalizeExcludeInput = (excludeRaw: string, sourcePath: string): string | undefined => {
  if (typeof excludeRaw !== 'string') {
    return undefined;
  }
  const trimmed = excludeRaw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  let normalized = path.normalize(trimmed.replace(/\\/g, path.sep));
  if (normalized === '.' || normalized === path.sep) {
    return undefined;
  }

  if (path.isAbsolute(normalized)) {
    const relativeCandidate = path.relative(sourcePath, normalized);
    const isInsideSource = relativeCandidate.length > 0
      && !relativeCandidate.startsWith('..')
      && !path.isAbsolute(relativeCandidate);
    if (isInsideSource) {
      normalized = path.normalize(relativeCandidate);
    }
  }

  normalized = trimTrailingPathSeparators(normalized);
  if (normalized.length === 0 || normalized === '.') {
    return undefined;
  }
  return normalized;
};

const normalizeCase = (value: string, caseInsensitive: boolean): string => {
  return caseInsensitive ? value.toLowerCase() : value;
};

const trimTrailingPathSeparators = (value: string): string => {
  let end = value.length;
  while (end > 0) {
    const code = value.charCodeAt(end - 1);
    if (code === 47 || code === 92) {
      end -= 1;
      continue;
    }
    break;
  }
  return value.slice(0, end);
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

const resolveEntryDestination = (destinationRoot: string, entryName: string): string => {
  const safeRelative = normalizeArchiveEntryName(entryName);
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
  return parts.join('/');
};

const readAllBytes = async (
  stream: ReadableStream<Uint8Array>,
  maxEntryBytes?: number,
  maxTotalBytes?: number,
  currentTotalBytes = 0
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
      if (!(chunk.value instanceof Uint8Array)) {
        continue;
      }
      entryTotal += chunk.value.length;
      if (typeof maxEntryBytes === 'number' && entryTotal > maxEntryBytes) {
        throw new DirArchiverError(
          'DIRARCHIVER_RESOURCE_LIMIT',
          `Entry exceeds maxEntryBytes (${maxEntryBytes}).`,
          {
            context: {
              maxEntryBytes,
              actualEntryBytes: entryTotal
            }
          }
        );
      }
      const projectedTotal = currentTotalBytes + entryTotal;
      if (typeof maxTotalBytes === 'number' && projectedTotal > maxTotalBytes) {
        throw new DirArchiverError(
          'DIRARCHIVER_RESOURCE_LIMIT',
          `Extraction exceeds maxTotalExtractedBytes (${maxTotalBytes}).`,
          {
            context: {
              maxTotalExtractedBytes: maxTotalBytes,
              projectedTotalBytes: projectedTotal
            }
          }
        );
      }
      chunks.push(chunk.value);
    }
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

const ensureParentDirectory = async (targetPath: string): Promise<void> => {
  await fsPromises.mkdir(path.dirname(targetPath), { recursive: true });
};

const createFileWritable = (targetPath: string): WritableStream<Uint8Array> => {
  const writable = createWriteStream(targetPath);
  return Writable.toWeb(writable) as WritableStream<Uint8Array>;
};

const inferFormatFromDestination = (destinationPath: string): ArchiveFormat | undefined => {
  const lower = destinationPath.toLowerCase();
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) return 'tar.gz';
  if (lower.endsWith('.tar.bz2')) return 'tar.bz2';
  if (lower.endsWith('.tar.xz')) return 'tar.xz';
  if (lower.endsWith('.tar.zst')) return 'tar.zst';
  if (lower.endsWith('.tar.br')) return 'tar.br';
  if (lower.endsWith('.tar')) return 'tar';
  if (lower.endsWith('.zip')) return 'zip';
  if (lower.endsWith('.gz')) return 'gz';
  if (lower.endsWith('.bz2')) return 'bz2';
  if (lower.endsWith('.xz')) return 'xz';
  if (lower.endsWith('.zst')) return 'zst';
  if (lower.endsWith('.br')) return 'br';
  return undefined;
};

export const copyStreamToFile = async (source: string, destination: string): Promise<void> => {
  await ensureParentDirectory(destination);
  const nodeReadable = createReadStream(source);
  const webReadable = Readable.toWeb(nodeReadable) as ReadableStream<Uint8Array>;
  const bytes = await readAllBytes(webReadable);
  await fsPromises.writeFile(destination, bytes);
};

export const pathExists = (value: string): boolean => existsSync(value);

export const fileSize = (value: string): number => statSync(value).size;

const disposeArchiveReader = async (reader: ArchiveReader): Promise<void> => {
  const withAsyncDispose = reader as {
    [Symbol.asyncDispose]?: () => Promise<void>;
    dispose?: () => Promise<void>;
    close?: () => Promise<void>;
  };
  const asyncDispose = withAsyncDispose[Symbol.asyncDispose];
  if (typeof asyncDispose === 'function') {
    await asyncDispose.call(withAsyncDispose);
    return;
  }
  if (typeof withAsyncDispose.dispose === 'function') {
    await withAsyncDispose.dispose();
    return;
  }
  if (typeof withAsyncDispose.close === 'function') {
    await withAsyncDispose.close();
  }
};
