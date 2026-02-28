import type { RuntimeBindings } from './types.js';

interface BunRuntimeModule {
  openArchive?: RuntimeBindings['openArchive'];
  createArchiveWriter?: RuntimeBindings['createArchiveWriter'];
}

let bunBindingsPromise: Promise<RuntimeBindings> | undefined;

export const loadBunBindings = async (): Promise<RuntimeBindings> => {
  bunBindingsPromise ??= import('@ismail-elkorchi/bytefold/bun')
    .then((moduleExports) => {
      const openArchive = (moduleExports as BunRuntimeModule).openArchive;
      const createArchiveWriter = (moduleExports as BunRuntimeModule).createArchiveWriter;
      if (typeof openArchive !== 'function' || typeof createArchiveWriter !== 'function') {
        throw new Error('Bytefold bun runtime exports are unavailable.');
      }
      return {
        runtime: 'bun',
        openArchive,
        createArchiveWriter
      } satisfies RuntimeBindings;
    });
  return bunBindingsPromise;
};
