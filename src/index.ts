/**
 * Deterministic directory archiving and extraction over zip, tar, and layered compression.
 *
 * Supports Node.js, Deno, and Bun through one API surface backed by bytefold.
 */
import { audit, detect, extract, list, normalize, open, write } from './core.js';

export {
  audit,
  detect,
  extract,
  list,
  normalize,
  open,
  write
};

export { DirArchiverError } from './errors.js';
export type { DirArchiverErrorCode, DirArchiverErrorJson } from './errors.js';
export type {
  ArchiveFormat,
  ArchiveLimits,
  ArchiveDetectionReport,
  ArchiveIssue,
  ArchiveNormalizeReport,
  ArchiveProfile,
  CliUsageError,
  DetectResult,
  DirArchiverInput,
  ExtractOptions,
  ExtractResult,
  ListEntry,
  ListResult,
  NormalizeOptions,
  NormalizeResult,
  OpenOptions,
  SupportedCommandMap,
  WriteOptions,
  WriteResult
} from './types.js';

/**
 * Namespace-style API contract mirrored by the default export.
 *
 * Consumers who prefer `import dirArchiver from "dir-archiver"` get the same
 * operations and semantics as the named exports on this interface.
 */
export interface DirArchiverNamespace {
  /** Open an archive reader after resolving format, limits, and runtime support. */
  readonly open: typeof open;
  /** Detect an archive format without extracting entries. */
  readonly detect: typeof detect;
  /** Project archive entries into a stable listing payload. */
  readonly list: typeof list;
  /** Audit an archive against the requested safety profile and limits. */
  readonly audit: typeof audit;
  /** Rewrite an archive into its normalized deterministic representation. */
  readonly normalize: typeof normalize;
  /** Extract an archive to disk with explicit safety and size controls. */
  readonly extract: typeof extract;
  /** Write a directory or file tree into an archive. */
  readonly write: typeof write;
}

/**
 * Namespace-style default export for consumers who prefer
 * `import dirArchiver from "dir-archiver"`.
 *
 * It mirrors the named exports exactly and does not add extra behavior.
 */
const api: DirArchiverNamespace = {
  open,
  detect,
  list,
  audit,
  normalize,
  extract,
  write
};

export default api;
