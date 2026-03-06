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
 *
 * String paths and `URL` objects are the most common inputs, but callers can
 * also supply raw bytes or web streams when the archive is already in memory.
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
  /** Resolved archive format after detection. */
  format: ArchiveFormat;
  /** Bytefold detection metadata, if the runtime produced it. */
  detection: ArchiveDetectionReport | undefined;
}

/**
 * Single archive entry projection used by list responses.
 */
export interface ListEntry {
  /** Entry format as exposed by the underlying reader. */
  format: ArchiveFormat;
  /** Entry path inside the archive, normalized to forward slashes. */
  name: string;
  /** Entry size encoded as a string for JSON-safe transport. */
  size: string;
  /** Whether the entry materializes as a directory. */
  isDirectory: boolean;
  /** Whether the entry is a symbolic link. */
  isSymlink: boolean;
  /** Link target when the entry is a symbolic link. */
  linkName?: string | undefined;
}

/**
 * Archive listing response payload.
 */
export interface ListResult {
  /** Resolved archive format. */
  format: ArchiveFormat;
  /** Bytefold detection metadata, if available. */
  detection: ArchiveDetectionReport | undefined;
  /** Projected archive entries in iteration order. */
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
  /** Request deterministic normalization when the runtime supports the knob. */
  deterministic?: boolean | undefined;
}

/**
 * Normalize operation result payload.
 */
export interface NormalizeResult {
  /** Source archive format that was normalized. */
  format: ArchiveFormat;
  /** Detailed normalization report from bytefold. */
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
  /** Source archive format that was extracted. */
  format: ArchiveFormat;
  /** Absolute destination directory path used for extraction. */
  destination: string;
  /** Number of file entries written to disk. */
  extractedFiles: number;
  /** Number of directory entries created on disk. */
  extractedDirectories: number;
  /** Number of entries skipped due to policy, such as disallowed symlinks. */
  skippedEntries: number;
  /** Audit issues collected before or during extraction. */
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
  /** Archive format emitted to the destination path. */
  format: ArchiveFormat;
  /** Absolute source path that was archived. */
  source: string;
  /** Absolute destination archive path that was written. */
  destination: string;
  /** Number of archive entries written. */
  entryCount: number;
  /** Whether a directory source was wrapped in a tar-based single-file codec. */
  wrappedDirectoryCodec: boolean;
}

/**
 * Usage-error shape emitted by CLI parsing.
 */
export interface CliUsageError {
  /** Human-readable summary of the CLI validation failure. */
  message: string;
  /** Individual issues returned by the command-line parser. */
  issues: readonly {
    code: string;
    message: string;
  }[];
}

/**
 * Canonical command identifiers supported by the CLI contract.
 */
export interface SupportedCommandMap {
  /** Literal identifier for the `open` command. */
  open: 'open';
  /** Literal identifier for the `detect` command. */
  detect: 'detect';
  /** Literal identifier for the `list` command. */
  list: 'list';
  /** Literal identifier for the `audit` command. */
  audit: 'audit';
  /** Literal identifier for the `extract` command. */
  extract: 'extract';
  /** Literal identifier for the `normalize` command. */
  normalize: 'normalize';
  /** Literal identifier for the `write` command. */
  write: 'write';
}
