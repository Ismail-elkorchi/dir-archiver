import type { CreateZipWriter, ZipWriterLike, ZipWriterOptions } from './types.js';

interface BunZipWriterLike {
	add: (
		name: string,
		source: Uint8Array | ArrayBuffer | ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>
	) => Promise<void>;
	close: () => Promise<void>;
}

interface BunZipWriterModule {
	zipToFile?: (
		path: string | URL,
		options?: ZipWriterOptions
	) => Promise<BunZipWriterLike>;
}

interface BunFileLike {
	arrayBuffer: () => Promise<ArrayBuffer>;
}

interface BunGlobalLike {
	file?: ( path: string | URL ) => BunFileLike;
}

let bunZipWriterPromise: Promise<CreateZipWriter> | undefined;

const normalizeWriterOptions = ( options?: ZipWriterOptions ): ZipWriterOptions | undefined => {
	if ( options?.sinkSeekabilityPolicy === 'on' ) {
		return {
			...options,
			sinkSeekabilityPolicy: 'auto'
		};
	}
	return options;
};

const readSourceAsUint8Array = async ( sourcePath: string ): Promise<Uint8Array> => {
	const bunGlobal = ( globalThis as { Bun?: BunGlobalLike } ).Bun;
	if ( typeof bunGlobal?.file !== 'function' ) {
		throw new Error( 'Bun file API is unavailable.' );
	}
	const sourceFile = bunGlobal.file( sourcePath );
	const sourceBytes = await sourceFile.arrayBuffer();
	return new Uint8Array( sourceBytes );
};

export const loadBunZipWriter = async (): Promise<CreateZipWriter> => {
	bunZipWriterPromise ??= import( '@ismail-elkorchi/bytefold/bun' )
		.then( ( moduleExports ) => {
			const zipToFile = ( moduleExports as BunZipWriterModule ).zipToFile;
			if ( typeof zipToFile !== 'function' ) {
				throw new Error( 'Bytefold bun zipToFile is unavailable.' );
			}
			return async ( filePath, options ) => {
				const writer = await zipToFile( filePath, normalizeWriterOptions( options ) );
				const wrappedWriter: ZipWriterLike = {
					add: async ( name, sourcePath ) => {
						const bytes = await readSourceAsUint8Array( sourcePath );
						await writer.add( name, bytes );
					},
					close: () => writer.close()
				};
				return wrappedWriter;
			};
		} );
	return bunZipWriterPromise;
};
