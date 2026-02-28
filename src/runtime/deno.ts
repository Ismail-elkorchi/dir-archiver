import type { RuntimeBindings } from './types.js';

interface DenoRuntimeModule {
  openArchive?: RuntimeBindings['openArchive'];
  createArchiveWriter?: RuntimeBindings['createArchiveWriter'];
}

let denoBindingsPromise: Promise<RuntimeBindings> | undefined;

export const loadDenoBindings = async (): Promise<RuntimeBindings> => {
  denoBindingsPromise ??= import('@ismail-elkorchi/bytefold/deno')
    .then((moduleExports) => {
      const openArchive = (moduleExports as DenoRuntimeModule).openArchive;
      const createArchiveWriter = (moduleExports as DenoRuntimeModule).createArchiveWriter;
      if (typeof openArchive !== 'function' || typeof createArchiveWriter !== 'function') {
        throw new Error('Bytefold deno runtime exports are unavailable.');
      }
      return {
        runtime: 'deno',
        openArchive,
        createArchiveWriter
      } satisfies RuntimeBindings;
    });
  return denoBindingsPromise;
};
