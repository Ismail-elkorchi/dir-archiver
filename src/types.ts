import type { ZipWriterAddOptions, ZipWriterOptions } from 'zip-next';

export type ArchiveReportMode = 'summary' | 'manifest';
export type ArchivePhase = 'scan' | 'write';
export type TimestampMode = 'preserve' | 'zero' | Date;

export interface ArchivePlanEntry {
  sourcePath: string;
  relativePath: string;
  zipPath: string;
  size: bigint;
  mtimeMs: number;
  isSymlink: boolean;
}

export interface ArchiveProgressEvent {
  phase: ArchivePhase;
  entry?: ArchivePlanEntry;
  entriesProcessed: number;
  totalEntries?: number;
  bytesProcessed: bigint;
  totalBytes?: bigint;
}

export interface ArchivePlanOptions {
  sourceDir: string;
  destZip?: string;
  includeBaseDirectory?: boolean;
  excludes?: string[];
  followSymlinks?: boolean;
  signal?: AbortSignal;
  onProgress?: (event: ArchiveProgressEvent) => void;
}

export interface ArchivePlan {
  sourceDir: string;
  destZip?: string;
  baseDirectory: string;
  includeBaseDirectory: boolean;
  followSymlinks: boolean;
  excludes: string[];
  entries: ArchivePlanEntry[];
  entryCount: number;
  totalBytes: bigint;
}

export interface ArchiveOptions extends ArchivePlanOptions {
  destZip: string;
  report?: ArchiveReportMode;
  zip?: Omit<ZipWriterOptions, 'signal' | 'onProgress'>;
  entry?: Omit<ZipWriterAddOptions, 'signal' | 'mtime'>;
  comment?: string;
  timestamps?: TimestampMode;
}

export interface ArchiveReport {
  sourceDir: string;
  zipPath: string;
  baseDirectory: string;
  includeBaseDirectory: boolean;
  followSymlinks: boolean;
  excludes: string[];
  entryCount: number;
  totalBytes: bigint;
  archiveBytes: bigint;
  durationMs: number;
  entries?: ArchivePlanEntry[];
}
