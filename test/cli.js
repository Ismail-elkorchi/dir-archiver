'use strict';

const assert = require( 'assert' );
const { spawnSync } = require( 'child_process' );
const fs = require( 'fs' );
const os = require( 'os' );
const path = require( 'path' );
const yauzl = require( 'yauzl' );

const runCli = ( args ) => spawnSync(
	process.execPath,
	[ path.join( __dirname, '..', 'dist', 'cli.js' ), ...args ],
	{ encoding: 'utf8' }
);

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

const run = async () => {
	const missingArgs = runCli( [] );
	assert.strictEqual( missingArgs.status, 1, 'CLI should exit with code 1 when args are missing' );
	assert.ok( missingArgs.stdout.includes( 'Dir Archiver could not be executed' ) );

	let tmpRoot;
	try {
		tmpRoot = fs.mkdtempSync( path.join( os.tmpdir(), 'dir-archiver-cli-' ) );
		const src = path.join( tmpRoot, 'src' );
		const dest = path.join( tmpRoot, 'archive.zip' );

		fs.mkdirSync( src );
		fs.writeFileSync( path.join( src, 'root.txt' ), 'root' );
		const cacheDir = path.join( src, 'cache' );
		fs.mkdirSync( cacheDir );
		fs.writeFileSync( path.join( cacheDir, 'cache.txt' ), 'cache' );

		const success = runCli( [ '--src', src, '--dest', dest ] );
		assert.strictEqual( success.status, 0, 'CLI should exit with code 0 on success' );
		assert.ok( fs.existsSync( dest ), 'CLI should create the archive' );

		const destInclude = path.join( tmpRoot, 'include.zip' );
		const includeResult = runCli( [ '--src', src, '--dest', destInclude, '--includebasedir=true' ] );
		assert.strictEqual( includeResult.status, 0, 'CLI should succeed with includebasedir true' );
		const entriesInclude = await listZipEntries( destInclude );
		const baseName = path.basename( src );
		assert.ok( entriesInclude.includes( `${baseName}/root.txt` ), 'includeBaseDirectory true should include the base directory' );

		const destExclude = path.join( tmpRoot, 'exclude.zip' );
		const excludeResult = runCli( [ '--src', src, '--dest', destExclude, '--includebasedir=false' ] );
		assert.strictEqual( excludeResult.status, 0, 'CLI should succeed with includebasedir false' );
		const entriesExclude = await listZipEntries( destExclude );
		assert.ok( entriesExclude.includes( 'root.txt' ), 'includeBaseDirectory false should keep root.txt at the archive root' );
		assert.ok( ! entriesExclude.includes( `${baseName}/root.txt` ), 'includeBaseDirectory false should not include the base directory' );

		const destExcludeInline = path.join( tmpRoot, 'exclude-inline.zip' );
		const excludeInlineResult = runCli( [ '--src', src, '--dest', destExcludeInline, '--exclude=cache' ] );
		assert.strictEqual( excludeInlineResult.status, 0, 'CLI should succeed with inline exclude values' );
		const entriesExcludeInline = await listZipEntries( destExcludeInline );
		assert.ok( ! entriesExcludeInline.includes( 'cache/cache.txt' ), 'inline exclude should remove matching entries' );

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

		if ( symlinkCreated ) {
			const destFollow = path.join( tmpRoot, 'follow.zip' );
			const followResult = runCli( [ '--src', src, '--dest', destFollow, '--followsymlinks=true' ] );
			assert.strictEqual( followResult.status, 0, 'CLI should succeed with followsymlinks true' );
			const entriesFollow = await listZipEntries( destFollow );
			assert.ok( entriesFollow.includes( 'external-link.txt' ), 'followsymlinks true should include symlinked files' );

			const destNoFollow = path.join( tmpRoot, 'nofollow.zip' );
			const noFollowResult = runCli( [ '--src', src, '--dest', destNoFollow, '--followsymlinks=false' ] );
			assert.strictEqual( noFollowResult.status, 0, 'CLI should succeed with followsymlinks false' );
			const entriesNoFollow = await listZipEntries( destNoFollow );
			assert.ok( ! entriesNoFollow.includes( 'external-link.txt' ), 'followsymlinks false should skip symlinked files' );
		}
	} finally {
		removeDir( tmpRoot );
	}
};

run().catch( ( err ) => {
	console.error( err );
	process.exitCode = 1;
} );
