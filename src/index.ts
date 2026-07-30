/**
 * Deterministic archive creation and extraction over Bytefold.
 *
 * The package exposes complete operations. Consumers that need a live
 * Bytefold reader should import Bytefold directly.
 */
export { audit, detect, extract, list, normalize, write } from './core.ts';
export { DirArchiverError } from './errors.ts';
export type { DirArchiverErrorCode, DirArchiverErrorJson } from './errors.ts';
export type {
  ArchiveAuditReport,
  ArchiveDetectionReport,
  ArchiveFormat,
  ArchiveInput,
  ArchiveIssue,
  ArchiveLimits,
  ArchiveNormalizeReport,
  ArchiveWriterFormat,
  DetectResult,
  ExtractOptions,
  ExtractResult,
  ListEntry,
  ListResult,
  NormalizeOptions,
  NormalizeResult,
  ReadOptions,
  SafetyProfile,
  WriteOptions,
  WriteResult
} from './types.ts';
