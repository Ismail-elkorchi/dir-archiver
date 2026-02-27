import { loadBunZipWriter } from './bun.js';
import { loadDenoZipWriter } from './deno.js';
import { loadNodeZipWriter } from './node.js';
import type { CreateZipWriter } from './types.js';

type RuntimeKind = 'node' | 'deno' | 'bun';

interface NodeProcessLike {
	versions?: {
		node?: string;
	};
}

const hasDenoGlobal = (): boolean => typeof ( globalThis as { Deno?: unknown } ).Deno !== 'undefined';

const hasBunGlobal = (): boolean => typeof ( globalThis as { Bun?: unknown } ).Bun !== 'undefined';

const hasNodeProcess = (): boolean => {
	const runtimeProcess = ( globalThis as { process?: NodeProcessLike } ).process;
	return typeof runtimeProcess?.versions?.node === 'string';
};

const detectRuntime = (): RuntimeKind => {
	if ( hasDenoGlobal() ) {
		return 'deno';
	}
	if ( hasBunGlobal() ) {
		return 'bun';
	}
	if ( hasNodeProcess() ) {
		return 'node';
	}
	throw new Error( 'Unsupported runtime. Expected Node.js, Deno, or Bun.' );
};

let runtimeZipWriterPromise: Promise<CreateZipWriter> | undefined;

export const loadRuntimeZipWriter = async (): Promise<CreateZipWriter> => {
	runtimeZipWriterPromise ??= ( async () => {
		const runtime = detectRuntime();
		if ( runtime === 'deno' ) {
			return loadDenoZipWriter();
		}
		if ( runtime === 'bun' ) {
			return loadBunZipWriter();
		}
		return loadNodeZipWriter();
	} )();
	return runtimeZipWriterPromise;
};
