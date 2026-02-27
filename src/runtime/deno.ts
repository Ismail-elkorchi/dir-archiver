import type { CreateZipWriter, ZipWriterLike, ZipWriterOptions } from './types.js';

interface DenoZipWriterLike {
	add: (
		name: string,
		source: Uint8Array | ArrayBuffer | ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>
	) => Promise<void>;
	close: () => Promise<void>;
}

interface DenoZipWriterModule {
	zipToFile?: (
		path: string | URL,
		options?: ZipWriterOptions
	) => Promise<DenoZipWriterLike>;
}

interface DenoGlobalLike {
	readFile?: ( path: string | URL ) => Promise<Uint8Array>;
}

let denoZipWriterPromise: Promise<CreateZipWriter> | undefined;

const normalizeWriterOptions = ( options?: ZipWriterOptions ): ZipWriterOptions | undefined => {
	if ( options?.sinkSeekabilityPolicy === 'on' ) {
		return {
			...options,
			sinkSeekabilityPolicy: 'auto'
		};
	}
	return options;
};

const getDenoReadFile = (): ( ( path: string | URL ) => Promise<Uint8Array> ) => {
	const denoGlobal = ( globalThis as { Deno?: DenoGlobalLike } ).Deno;
	if ( typeof denoGlobal?.readFile !== 'function' ) {
		throw new Error( 'Deno readFile is unavailable.' );
	}
	return denoGlobal.readFile.bind( denoGlobal );
};

export const loadDenoZipWriter = async (): Promise<CreateZipWriter> => {
	denoZipWriterPromise ??= import( '@ismail-elkorchi/bytefold/deno' )
		.then( ( moduleExports ) => {
			const zipToFile = ( moduleExports as DenoZipWriterModule ).zipToFile;
			if ( typeof zipToFile !== 'function' ) {
				throw new Error( 'Bytefold deno zipToFile is unavailable.' );
			}
			return async ( filePath, options ) => {
				const readFile = getDenoReadFile();
				const writer = await zipToFile( filePath, normalizeWriterOptions( options ) );
				const wrappedWriter: ZipWriterLike = {
					add: async ( name, sourcePath ) => {
						const bytes = await readFile( sourcePath );
						await writer.add( name, bytes );
					},
					close: () => writer.close()
				};
				return wrappedWriter;
			};
		} );
	return denoZipWriterPromise;
};
