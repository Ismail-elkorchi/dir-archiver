import type { RuntimeBindings } from './types.js';

interface NodeRuntimeModule {
  openArchive?: RuntimeBindings['openArchive'];
  createArchiveWriter?: RuntimeBindings['createArchiveWriter'];
}

let nodeBindingsPromise: Promise<RuntimeBindings> | undefined;

export const loadNodeBindings = async (): Promise<RuntimeBindings> => {
  nodeBindingsPromise ??= import('@ismail-elkorchi/bytefold/node')
    .then((moduleExports) => {
      const openArchive = (moduleExports as NodeRuntimeModule).openArchive;
      const createArchiveWriter = (moduleExports as NodeRuntimeModule).createArchiveWriter;
      if (typeof openArchive !== 'function' || typeof createArchiveWriter !== 'function') {
        throw new Error('Bytefold node runtime exports are unavailable.');
      }
      return {
        runtime: 'node',
        openArchive,
        createArchiveWriter
      } satisfies RuntimeBindings;
    });
  return nodeBindingsPromise;
};
