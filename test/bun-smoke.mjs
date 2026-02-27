import { join } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import DirArchiver from '../dist/index.js';

const run = async () => {
	const normalizedTmpRoot = mkdtempSync( join( tmpdir(), 'dir-archiver-bun-' ) );

	try {
		const src = join( normalizedTmpRoot, 'src' );
		const nested = join( src, 'nested' );
		const dest = join( normalizedTmpRoot, 'archive.zip' );

		mkdirSync( nested, { recursive: true } );
		writeFileSync( join( src, 'root.txt' ), 'root' );
		writeFileSync( join( nested, 'nested.txt' ), 'nested' );

		const archive = new DirArchiver( src, dest, false, [] );
		await archive.createZip();

		if ( ! existsSync( dest ) ) {
			throw new Error( 'Bun smoke: destination archive was not created.' );
		}
		const stats = statSync( dest );
		if ( ! stats.isFile() || stats.size <= 0 ) {
			throw new Error( 'Bun smoke: destination archive is invalid.' );
		}
	} finally {
		rmSync( normalizedTmpRoot, { recursive: true, force: true } );
	}
};

run().catch( ( err ) => {
	console.error( err );
	process.exitCode = 1;
} );
