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
 * Common options forwarded to bytefold open operations.
 */
export interface OpenOptions
{
  format?: ArchiveOpenOptions['format'] | undefined;
  profile?: ArchiveOpenOptions['profile'] | undefined;
  isStrict?: ArchiveOpenOptions['isStrict'] | undefined;
  limits?: ArchiveOpenOptions['limits'] | undefined;
  signal?: ArchiveOpenOptions['signal'] | undefined;
  password?: ArchiveOpenOptions['password'] | undefined;
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
 */
export interface ExtractOptions extends OpenOptions {
  allowSymlinks?: boolean | undefined;
  allowHardlinks?: boolean | undefined;
  maxEntryBytes?: number | undefined;
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
  format?: ArchiveFormat | undefined;
  includeBaseDirectory?: boolean | undefined;
  followSymlinks?: boolean | undefined;
  exclude?: string[] | undefined;
  profile?: ArchiveProfile | undefined;
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
