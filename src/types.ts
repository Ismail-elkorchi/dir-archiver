import type {
  ArchiveDetectionReport,
  ArchiveFormat,
  ArchiveIssue,
  ArchiveLimits,
  ArchiveNormalizeReport,
  ArchiveOpenOptions,
  ArchiveProfile
} from '@ismail-elkorchi/bytefold';

export type { ArchiveFormat, ArchiveLimits, ArchiveProfile };

/**
 * Accepted input shapes for archive read operations.
 */
export type DirArchiverInput =
  | string
  | URL
  | Uint8Array
  | ArrayBuffer
  | ReadableStream<Uint8Array>
  | Blob;

/**
 * Common options forwarded to bytefold archive-open operations.
 *
 * Used by `open()`, `detect()`, `list()`, and `audit()`.
 */
export interface OpenOptions
{
  /**
   * Explicit format override when callers already know archive type.
   */
  format?: ArchiveOpenOptions['format'] | undefined;
  /**
   * Safety profile (`compat`, `strict`, `agent`) applied during reads/audits.
   */
  profile?: ArchiveOpenOptions['profile'] | undefined;
  /**
   * Extra strictness toggle forwarded to bytefold parsing.
   */
  isStrict?: ArchiveOpenOptions['isStrict'] | undefined;
  /**
   * Parser/resource limits enforced while opening or auditing archives.
   */
  limits?: ArchiveOpenOptions['limits'] | undefined;
  /**
   * Abort signal for cancelling in-flight async operations.
   */
  signal?: ArchiveOpenOptions['signal'] | undefined;
  /**
   * Password used for encrypted archives when supported by the runtime.
   */
  password?: ArchiveOpenOptions['password'] | undefined;
  /**
   * Filename hint used for extension-based inference with non-path inputs.
   */
  filename?: ArchiveOpenOptions['filename'] | undefined;
}

/**
 * Format detection result.
 */
export interface DetectResult {
  format: ArchiveFormat;
  detection: ArchiveDetectionReport | undefined;
}

/**
 * Single archive entry projection used by list responses.
 */
export interface ListEntry {
  format: ArchiveFormat;
  name: string;
  size: string;
  isDirectory: boolean;
  isSymlink: boolean;
  linkName?: string | undefined;
}

/**
 * Archive listing response payload.
 */
export interface ListResult {
  format: ArchiveFormat;
  detection: ArchiveDetectionReport | undefined;
  entries: ListEntry[];
}

/**
 * Options for `audit()`.
 *
 * Alias of `OpenOptions` for stable API typing; CLI-only flags (for example
 * `--json`) are not part of this programmatic surface.
 */
export type AuditOptions = OpenOptions;

/**
 * Normalize operation options.
 */
export interface NormalizeOptions extends OpenOptions {
  deterministic?: boolean | undefined;
}

/**
 * Normalize operation result payload.
 */
export interface NormalizeResult {
  format: ArchiveFormat;
  report: ArchiveNormalizeReport;
}

/**
 * Extraction options with explicit safety limits.
 *
 * `extract()` defaults to `profile: 'strict'` when no profile is supplied.
 */
export interface ExtractOptions extends OpenOptions {
  /**
   * If `true`, symbolic-link entries are materialized on disk; otherwise they
   * are skipped and counted in `ExtractResult.skippedEntries`.
   */
  allowSymlinks?: boolean | undefined;
  /**
   * Reserved for forward compatibility. Hard-link entries are currently
   * rejected with `DIRARCHIVER_UNSUPPORTED_ENTRY` regardless of this flag.
   */
  allowHardlinks?: boolean | undefined;
  /**
   * Maximum bytes allowed for any single extracted file entry.
   */
  maxEntryBytes?: number | undefined;
  /**
   * Maximum cumulative bytes allowed across all extracted file entries.
   */
  maxTotalExtractedBytes?: number | undefined;
}

/**
 * Extraction summary result.
 */
export interface ExtractResult {
  format: ArchiveFormat;
  destination: string;
  extractedFiles: number;
  extractedDirectories: number;
  skippedEntries: number;
  issues: ArchiveIssue[];
}

/**
 * Archive writer options.
 */
export interface WriteOptions {
  /**
   * Requested output format. If omitted, inferred from destination extension
   * and falls back to `zip` when inference is not possible.
   */
  format?: ArchiveFormat | undefined;
  /**
   * Includes the source directory name as a root folder in the archive when
   * source is a directory.
   */
  includeBaseDirectory?: boolean | undefined;
  /**
   * Follows symbolic links while walking directory sources for `write()`.
   */
  followSymlinks?: boolean | undefined;
  /**
   * Glob-like exclusion patterns evaluated relative to the source root.
   */
  exclude?: string[] | undefined;
  /**
   * Writer profile (`compat`, `strict`, `agent`) forwarded to bytefold.
   */
  profile?: ArchiveProfile | undefined;
  /**
   * Optional writer limits passed through to bytefold operations.
   */
  limits?: ArchiveLimits | undefined;
}

/**
 * Archive writer result payload.
 */
export interface WriteResult {
  format: ArchiveFormat;
  source: string;
  destination: string;
  entryCount: number;
  wrappedDirectoryCodec: boolean;
}

/**
 * Usage-error shape emitted by CLI parsing.
 */
export interface CliUsageError {
  message: string;
  issues: readonly {
    code: string;
    message: string;
  }[];
}

/**
 * Canonical command identifiers supported by the CLI contract.
 */
export interface SupportedCommandMap {
  open: 'open';
  detect: 'detect';
  list: 'list';
  audit: 'audit';
  extract: 'extract';
  normalize: 'normalize';
  write: 'write';
}
