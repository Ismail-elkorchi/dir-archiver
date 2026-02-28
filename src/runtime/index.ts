import { DirArchiverError } from '../errors.js';
import { loadBunBindings } from './bun.js';
import { loadDenoBindings } from './deno.js';
import { loadNodeBindings } from './node.js';
import type { RuntimeBindings, RuntimeKind } from './types.js';

interface NodeProcessLike {
  versions?: {
    node?: string;
  };
}

interface DenoGlobalLike {
  version?: {
    deno?: string;
  };
}

interface BunGlobalLike {
  version?: string;
}

const hasDenoGlobal = (): boolean =>
  typeof (globalThis as { Deno?: DenoGlobalLike }).Deno?.version?.deno === 'string';

const hasBunGlobal = (): boolean =>
  typeof (globalThis as { Bun?: BunGlobalLike }).Bun?.version === 'string';

const hasNodeProcess = (): boolean =>
  typeof (globalThis as { process?: NodeProcessLike }).process?.versions?.node === 'string';

const detectRuntime = (): RuntimeKind => {
  if (hasDenoGlobal()) {
    return 'deno';
  }
  if (hasBunGlobal()) {
    return 'bun';
  }
  if (hasNodeProcess()) {
    return 'node';
  }
  throw new DirArchiverError(
    'DIRARCHIVER_RUNTIME_UNSUPPORTED',
    'Unsupported runtime. Expected Node.js, Deno, or Bun.'
  );
};

let runtimeBindingsPromise: Promise<RuntimeBindings> | undefined;

export const loadRuntimeBindings = async (): Promise<RuntimeBindings> => {
  runtimeBindingsPromise ??= (async () => {
    const runtime = detectRuntime();
    if (runtime === 'deno') {
      return loadDenoBindings();
    }
    if (runtime === 'bun') {
      return loadBunBindings();
    }
    return loadNodeBindings();
  })();
  return runtimeBindingsPromise;
};
