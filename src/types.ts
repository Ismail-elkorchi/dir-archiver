import type {
  ArchiveFormat,
  ArchiveProfile
} from '@ismail-elkorchi/bytefold';

export type {
  ArchiveFormat,
  ArchiveProfile,
} from '@ismail-elkorchi/bytefold';

/**
 * Resource-limit configuration forwarded to bytefold read, audit, extract,
 * and normalize flows. Accepted fields are documented in `docs/api.md`.
 */
export type ArchiveLimits = Record<string, unknown>;

/** Issue shape emitted for archive read, normalize, and extract reports. */
export type ArchiveIssue = Record<string, unknown>;

/** Public detection report shape aligned with runtime diagnostics payloads. */
export type ArchiveDetectionReport = Record<string, unknown>;

/** Public normalize report shape for deterministic archive rewrites. */
export type ArchiveNormalizeReport = Record<string, unknown>;

/**
 * Accepted input shapes for archive read operations.
 *
 * String paths and `URL` objects can identify local files or remote HTTP(S)
 * inputs through the active runtime adapter. Callers can also supply raw bytes,
 * web streams, or blobs when the archive is already in memory.
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
 * Used directly by `open()`, `detect()`, `list()`, and `audit()`, and inherited
 * by extraction and normalization options.
 */
export interface OpenOptions
{
  /**
   * Explicit format override when callers already know the archive type.
   * Use `auto` or omit the field to detect from filename hints and bytes.
   */
  format?: ArchiveFormat | 'auto' | undefined;
  /**
   * Safety profile (`compat`, `strict`, `agent`) applied during reads and
   * audits. Current bytefold readers default to `strict` when omitted.
   */
  profile?: ArchiveProfile | undefined;
  /**
   * Advanced parser-strictness override forwarded to bytefold.
   * This does not replace extraction profile enforcement.
   */
  isStrict?: boolean | undefined;
  /**
   * Parser, decompression, entry, and audit resource limits forwarded to
   * bytefold. These differ from extraction materialization byte limits.
   */
  limits?: ArchiveLimits | undefined;
  /**
   * Abort signal for cancelling supported in-flight async operations.
   */
  signal?: AbortSignal | undefined;
  /**
   * Password used for encrypted ZIP members when supported by the runtime.
   */
  password?: string | undefined;
  /**
   * Filename hint used for extension-based inference with non-path inputs.
   */
  filename?: string | undefined;
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
  /** Entry size encoded as a decimal string for JSON-safe transport. */
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
  /** Resolved archive format after detection/open completed. */
  format: ArchiveFormat;
  /** Bytefold detection metadata used to choose `format`, when available. */
  detection: ArchiveDetectionReport | undefined;
  /** Projected archive entries in archive iteration order. */
  entries: ListEntry[];
}

/**
 * Options for `audit()`.
 *
 * Alias of `OpenOptions` for stable API typing; CLI-only flags such as
 * `--json` are not part of this programmatic surface.
 */
export type AuditOptions = OpenOptions;

/**
 * Normalize operation options.
 */
export interface NormalizeOptions extends OpenOptions {
  /** Request deterministic normalization; defaults to `true`. */
  deterministic?: boolean | undefined;
}

/**
 * Normalize operation result payload.
 */
export interface NormalizeResult {
  /** Source archive format that was normalized. */
  format: ArchiveFormat;
  /** Versioned normalization report produced by bytefold. */
  report: ArchiveNormalizeReport;
}

/**
 * Extraction options with explicit safety and materialization limits.
 *
 * `extract()` defaults to `profile: 'strict'` when no profile is supplied.
 */
export interface ExtractOptions extends OpenOptions {
  /**
   * If `true`, permitted symbolic-link entries are materialized on disk;
   * otherwise they are skipped and counted in `skippedEntries`.
   * Agent profile can reject symlink presence before materialization.
   */
  allowSymlinks?: boolean | undefined;
  /**
   * Reserved for forward compatibility. Hard-link entries are rejected with
   * `DIRARCHIVER_UNSUPPORTED_ENTRY` regardless of this flag in v3.
   */
  allowHardlinks?: boolean | undefined;
  /**
   * Maximum bytes buffered and written for any one regular file entry.
   */
  maxEntryBytes?: number | undefined;
  /**
   * Maximum cumulative regular-file bytes written by one extraction run.
   */
  maxTotalExtractedBytes?: number | undefined;
}

/**
 * Extraction summary result.
 */
export interface ExtractResult {
  /** Source archive format that was extracted to disk. */
  format: ArchiveFormat;
  /** Absolute destination directory path used for extraction. */
  destination: string;
  /** Number of regular file entries written to disk. */
  extractedFiles: number;
  /** Number of directory entries created during archive iteration. */
  extractedDirectories: number;
  /** Number of entries skipped by policy, such as disallowed symlinks. */
  skippedEntries: number;
  /** Audit issues collected by the extraction flow. */
  issues: ArchiveIssue[];
}

/**
 * Archive writer options.
 */
export interface WriteOptions {
  /**
   * Requested output format. If omitted, inferred from the destination
   * extension and falling back to `zip` when inference is not possible.
   */
  format?: ArchiveFormat | undefined;
  /**
   * Include the source directory name as the archive root prefix when the
   * source is a directory.
   */
  includeBaseDirectory?: boolean | undefined;
  /**
   * Follow symbolic-link targets while walking directory sources. Targets can
   * resolve outside the source root, so use this only for trusted layouts.
   */
  followSymlinks?: boolean | undefined;
  /**
   * Exact exclusions evaluated while walking the source root. A value without
   * a path separator matches that basename anywhere; a value with a separator
   * matches one source-relative path. Wildcard syntax is not expanded.
   */
  exclude?: string[] | undefined;
  /**
   * Reserved for forward compatibility. Current `write()` behavior does not
   * forward a writer profile to bytefold.
   */
  profile?: ArchiveProfile | undefined;
  /**
   * Reserved for forward compatibility. Current `write()` behavior does not
   * forward writer limits to bytefold.
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
  /** Number of regular file entries written to the output archive. */
  entryCount: number;
  /** Whether a directory source was mapped to a TAR-based codec format. */
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
