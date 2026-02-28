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
