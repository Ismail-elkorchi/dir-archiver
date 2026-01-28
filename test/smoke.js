'use strict';

const assert = require( 'assert' );
const fs = require( 'fs' );
const os = require( 'os' );
const path = require( 'path' );
const yauzl = require( 'yauzl' );
const DirArchiver = require( '../dist/index' );

const normalizeEntry = ( entry ) => entry.replace( /\\/g, '/' );

const listZipEntries = ( zipPath ) => new Promise( ( resolve, reject ) => {
	yauzl.open( zipPath, { lazyEntries: true }, ( err, zipfile ) => {
		if ( err ) {
			reject( err );
			return;
		}

		const entries = [];

		zipfile.on( 'entry', ( entry ) => {
			entries.push( normalizeEntry( entry.fileName ) );
			zipfile.readEntry();
		} );

		zipfile.on( 'end', () => {
			zipfile.close();
			resolve( entries );
		} );

		zipfile.on( 'error', ( zipErr ) => {
			reject( zipErr );
		} );

		zipfile.readEntry();
	} );
} );

const removeDir = ( dirPath ) => {
	if ( ! dirPath ) {
		return;
	}
	if ( typeof fs.rmSync === 'function' ) {
		fs.rmSync( dirPath, { recursive: true, force: true } );
		return;
	}
	fs.rmdirSync( dirPath, { recursive: true } );
};

const run = async () => {
	let tmpRoot;
	try {
		tmpRoot = fs.mkdtempSync( path.join( os.tmpdir(), 'dir-archiver-' ) );
		const src = path.join( tmpRoot, 'src' );
		const nested = path.join( src, 'nested' );

		fs.mkdirSync( src );
		fs.mkdirSync( nested );

		fs.writeFileSync( path.join( src, 'root.txt' ), 'root' );
		fs.writeFileSync( path.join( nested, 'nested.txt' ), 'nested' );

		const destInside = path.join( src, 'archive.zip' );
		const archiveInside = new DirArchiver( src, destInside, false, [ 'nested' ] );
		await archiveInside.createZip();

		assert.ok( fs.existsSync( destInside ), 'archive should be created' );

		const entriesInside = await listZipEntries( destInside );
		assert.ok( entriesInside.includes( 'root.txt' ), 'root.txt should be included' );
		assert.ok( ! entriesInside.includes( 'archive.zip' ), 'archive.zip should be excluded' );
		assert.ok( ! entriesInside.some( ( entry ) => entry.startsWith( 'nested/' ) ), 'nested folder should be excluded' );

		const destOutside = path.join( tmpRoot, 'outside.zip' );
		const archiveOutside = new DirArchiver( src, destOutside, true, [] );
		await archiveOutside.createZip();

		const entriesOutside = await listZipEntries( destOutside );
		const baseName = path.basename( src );
		const expectedBaseEntry = `${baseName}/root.txt`;
		assert.ok( entriesOutside.includes( expectedBaseEntry ), 'base directory should be included' );
		assert.ok( ! entriesOutside.includes( 'root.txt' ), 'root.txt should not be at archive root' );
	} finally {
		removeDir( tmpRoot );
	}
};

run().catch( ( err ) => {
	console.error( err );
	process.exitCode = 1;
} );
