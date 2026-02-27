import type { CreateZipWriter } from './types.js';

interface NodeZipWriterModule {
	ZipWriter?: {
		toFile?: CreateZipWriter;
	};
}

let nodeZipWriterPromise: Promise<CreateZipWriter> | undefined;

export const loadNodeZipWriter = async (): Promise<CreateZipWriter> => {
	nodeZipWriterPromise ??= import( '@ismail-elkorchi/bytefold/node/zip' )
		.then( ( moduleExports ) => {
			const ZipWriter = ( moduleExports as NodeZipWriterModule ).ZipWriter;
			if ( ! ZipWriter || typeof ZipWriter.toFile !== 'function' ) {
				throw new Error( 'Bytefold node ZipWriter.toFile is unavailable.' );
			}
			return ZipWriter.toFile.bind( ZipWriter );
		} );
	return nodeZipWriterPromise;
};
