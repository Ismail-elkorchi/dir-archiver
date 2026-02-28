import type { ArchiveFormat, ArchiveOpenOptions, ArchiveReader } from '@ismail-elkorchi/bytefold';

export type RuntimeKind = 'node' | 'deno' | 'bun';

export interface ArchiveWriterLike {
  add: (
    name: string,
    source: Uint8Array | ArrayBuffer | ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>
  ) => Promise<void>;
  close: () => Promise<void>;
}

export interface RuntimeBindings {
  runtime: RuntimeKind;
  openArchive: (input: unknown, options?: ArchiveOpenOptions) => Promise<ArchiveReader>;
  createArchiveWriter: (
    format: ArchiveFormat,
    writable: WritableStream<Uint8Array>,
    options?: unknown
  ) => ArchiveWriterLike;
}
