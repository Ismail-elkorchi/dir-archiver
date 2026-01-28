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
		fs.writeFileSync( path.join( nested, 'skip.txt' ), 'skip' );

		const cacheDir = path.join( src, 'cache' );
		const nestedCacheDir = path.join( nested, 'cache' );
		fs.mkdirSync( cacheDir );
		fs.mkdirSync( nestedCacheDir );
		fs.writeFileSync( path.join( cacheDir, 'cache.txt' ), 'cache' );
		fs.writeFileSync( path.join( nestedCacheDir, 'nested-cache.txt' ), 'nested-cache' );

		const deepRoot = path.join( src, 'deep' );
		fs.mkdirSync( deepRoot );
		let deepCursor = deepRoot;
		for ( let i = 0; i < 40; i++ ) {
			const next = path.join( deepCursor, `level-${i}` );
			fs.mkdirSync( next );
			deepCursor = next;
		}
		const deepFilePath = path.join( deepCursor, 'deep.txt' );
		fs.writeFileSync( deepFilePath, 'deep' );

		let symlinkCreated = false;
		const externalTarget = path.join( tmpRoot, 'external.txt' );
		const symlinkPath = path.join( src, 'external-link.txt' );
		fs.writeFileSync( externalTarget, 'external' );
		try {
			fs.symlinkSync( externalTarget, symlinkPath );
			symlinkCreated = true;
		} catch {
			symlinkCreated = false;
		}

		let symlinkDirCreated = false;
		const externalDir = path.join( tmpRoot, 'external-dir' );
		const externalDirFile = path.join( externalDir, 'external.txt' );
		fs.mkdirSync( externalDir );
		fs.writeFileSync( externalDirFile, 'external-dir' );
		const symlinkDirPath = path.join( src, 'linked-external' );
		try {
			fs.symlinkSync( externalDir, symlinkDirPath, 'dir' );
			symlinkDirCreated = true;
		} catch {
			symlinkDirCreated = false;
		}

		let loopSymlinkCreated = false;
		const loopSymlinkPath = path.join( src, 'loop' );
		try {
			fs.symlinkSync( src, loopSymlinkPath, 'dir' );
			loopSymlinkCreated = true;
		} catch {
			loopSymlinkCreated = false;
		}

		const destInside = path.join( src, 'archive.zip' );
		const archiveInside = new DirArchiver( src, destInside, false, [ 'nested' ] );
		await archiveInside.createZip();

		assert.ok( fs.existsSync( destInside ), 'archive should be created' );

		const entriesInside = await listZipEntries( destInside );
		assert.ok( entriesInside.includes( 'root.txt' ), 'root.txt should be included' );
		assert.ok( ! entriesInside.includes( 'archive.zip' ), 'archive.zip should be excluded' );
		assert.ok( ! entriesInside.some( ( entry ) => entry.startsWith( 'nested/' ) ), 'nested folder should be excluded' );
		if ( symlinkCreated ) {
			assert.ok( ! entriesInside.includes( 'external-link.txt' ), 'symlink should be skipped by default' );
		}
		if ( symlinkDirCreated ) {
			assert.ok( ! entriesInside.some( ( entry ) => entry.startsWith( 'linked-external/' ) ), 'symlinked directories should be skipped by default' );
		}
		if ( loopSymlinkCreated ) {
			assert.ok( ! entriesInside.some( ( entry ) => entry.startsWith( 'loop/' ) ), 'loop symlink should be skipped by default' );
		}

		const fileExcludePath = path.join( 'nested', 'skip.txt' );
		const destExclude = path.join( tmpRoot, 'exclude.zip' );
		const archiveExclude = new DirArchiver( src, destExclude, false, [ fileExcludePath ] );
		await archiveExclude.createZip();
		const entriesExclude = await listZipEntries( destExclude );
		assert.ok( entriesExclude.includes( 'nested/nested.txt' ), 'nested.txt should be included when only excluding skip.txt' );
		assert.ok( ! entriesExclude.includes( 'nested/skip.txt' ), 'skip.txt should be excluded by file path' );

		const destDeep = path.join( tmpRoot, 'deep.zip' );
		const archiveDeep = new DirArchiver( src, destDeep, false, [] );
		await archiveDeep.createZip();
		const entriesDeep = await listZipEntries( destDeep );
		const deepRelative = normalizeEntry( path.relative( src, deepFilePath ) );
		assert.ok( entriesDeep.includes( deepRelative ), 'deep file should be included' );

		const destNameExclude = path.join( tmpRoot, 'name-exclude.zip' );
		const archiveNameExclude = new DirArchiver( src, destNameExclude, false, [ 'cache' ] );
		await archiveNameExclude.createZip();
		const entriesNameExclude = await listZipEntries( destNameExclude );
		assert.ok( ! entriesNameExclude.includes( 'cache/cache.txt' ), 'cache directory should be excluded by name' );
		assert.ok( ! entriesNameExclude.includes( 'nested/cache/nested-cache.txt' ), 'nested cache directory should be excluded by name' );

		if ( symlinkCreated || symlinkDirCreated || loopSymlinkCreated ) {
			const destFollow = path.join( tmpRoot, 'follow.zip' );
			const archiveFollow = new DirArchiver( src, destFollow, false, [], true );
			await archiveFollow.createZip();
			const entriesFollow = await listZipEntries( destFollow );
			if ( symlinkCreated ) {
				assert.ok( entriesFollow.includes( 'external-link.txt' ), 'symlink should be included when following symlinks' );
			}
			if ( symlinkDirCreated ) {
				assert.ok( entriesFollow.includes( 'linked-external/external.txt' ), 'symlinked directories should be included when following symlinks' );
			}
			if ( loopSymlinkCreated ) {
				assert.ok( ! entriesFollow.some( ( entry ) => entry.startsWith( 'loop/' ) ), 'loop symlink should not be traversed' );
			}
		}

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
