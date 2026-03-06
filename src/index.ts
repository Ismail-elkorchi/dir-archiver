/**
 * dir-archiver v3 API surface.
 *
 * v3 is a bytefold-backed orchestration layer that supports Node.js, Deno, and Bun.
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
export type { DirArchiverErrorCode } from './errors.js';
export type {
  ArchiveFormat,
  ArchiveLimits,
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
 * Namespace-style default export for consumers who prefer
 * `import dirArchiver from "dir-archiver"`.
 *
 * It mirrors the named exports exactly and does not add extra behavior.
 */
const api = {
  open,
  detect,
  list,
  audit,
  normalize,
  extract,
  write
};

export default api;
