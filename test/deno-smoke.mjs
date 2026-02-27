/* global Deno */
import { join } from 'node:path';
import { mkdirSync, writeFileSync, existsSync, rmSync, statSync } from 'node:fs';
import DirArchiver from '../dist/index.js';

const run = async () => {
	const tmpRoot = await Deno.makeTempDir( { prefix: 'dir-archiver-deno-' } );

	try {
		const src = join( tmpRoot, 'src' );
		const nested = join( src, 'nested' );
		const dest = join( tmpRoot, 'archive.zip' );

		mkdirSync( nested, { recursive: true } );
		writeFileSync( join( src, 'root.txt' ), 'root' );
		writeFileSync( join( nested, 'nested.txt' ), 'nested' );

		const archive = new DirArchiver( src, dest, false, [] );
		await archive.createZip();

		if ( ! existsSync( dest ) ) {
			throw new Error( 'Deno smoke: destination archive was not created.' );
		}
		const stats = statSync( dest );
		if ( ! stats.isFile() || stats.size <= 0 ) {
			throw new Error( 'Deno smoke: destination archive is invalid.' );
		}
	} finally {
		rmSync( tmpRoot, { recursive: true, force: true } );
	}
};

run().catch( ( err ) => {
	console.error( err );
	Deno.exit( 1 );
} );
