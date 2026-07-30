import type {
  ArchiveDetectionReport,
  ArchiveFormat,
  ArchiveIssue,
  ArchiveNormalizeReport,
  ArchiveOpenOptions,
  ArchiveWriterFormat
} from '@ismail-elkorchi/bytefold';

export type {
  ArchiveAuditReport,
  ArchiveDetectionReport,
  ArchiveFormat,
  ArchiveInput,
  ArchiveIssue,
  ArchiveLimits,
  ArchiveNormalizeReport,
  ArchiveWriterFormat,
  SafetyProfile
} from '@ismail-elkorchi/bytefold';

/** Shared options for archive detection, listing, audit, extraction, and normalization. */
export type ReadOptions = Readonly<Pick<
  ArchiveOpenOptions,
  'format' | 'safetyProfile' | 'limits' | 'signal' | 'password' | 'filename'
>>;

/** Format detection result. */
export type DetectResult = {
  /** Resolved archive format. */
  format: ArchiveFormat;
  /** Detection metadata when available. */
  detection: ArchiveDetectionReport | undefined;
};

/** JSON-safe projection of one archive entry. */
export type ListEntry = {
  format: ArchiveFormat;
  name: string;
  sizeInBytes: string;
  isDirectory: boolean;
  isSymlink: boolean;
  linkName?: string;
};

/** Archive listing result. */
export type ListResult = {
  format: ArchiveFormat;
  detection: ArchiveDetectionReport | undefined;
  entries: ListEntry[];
};

/** Options for deterministic normalization. */
export type NormalizeOptions = ReadOptions & {
  /** Request deterministic ordering and metadata; defaults to `true`. */
  readonly isDeterministic?: boolean;
};

/** Normalize operation result. */
export type NormalizeResult = {
  format: ArchiveFormat;
  report: ArchiveNormalizeReport;
};

/** Extraction policy and materialization limits. */
export type ExtractOptions = ReadOptions & {
  /** Materialize safe relative symlink entries instead of skipping them. */
  readonly allowSymlinks?: boolean;
  /** Maximum bytes materialized for one regular file. */
  readonly maxExtractedFileBytes?: number;
  /** Maximum cumulative regular-file bytes materialized by one call. */
  readonly maxTotalExtractedBytes?: number;
};

/** Extraction summary. */
export type ExtractResult = {
  format: ArchiveFormat;
  destination: string;
  extractedFileCount: number;
  extractedDirectoryCount: number;
  extractedSymlinkCount: number;
  skippedEntryCount: number;
  issues: ArchiveIssue[];
};

/** Archive creation options. */
export type WriteOptions = {
  /** Output archive format, inferred from the destination and then defaulting to ZIP. */
  readonly format?: ArchiveWriterFormat;
  /** Prefix entries with the source directory name. */
  readonly includeBaseDirectory?: boolean;
  /** Follow filesystem symlinks, including targets outside the source root. */
  readonly followSymlinks?: boolean;
  /** Basenames or exact source-relative paths to exclude. */
  readonly exclude?: readonly string[];
};

/** Archive creation summary. */
export type WriteResult = {
  format: ArchiveWriterFormat;
  source: string;
  destination: string;
  entryCount: number;
};
