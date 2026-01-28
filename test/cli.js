'use strict';

const assert = require( 'assert' );
const { spawnSync } = require( 'child_process' );
const fs = require( 'fs' );
const os = require( 'os' );
const path = require( 'path' );

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

const run = () => {
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

		const success = runCli( [ '--src', src, '--dest', dest ] );
		assert.strictEqual( success.status, 0, 'CLI should exit with code 0 on success' );
		assert.ok( fs.existsSync( dest ), 'CLI should create the archive' );
	} finally {
		removeDir( tmpRoot );
	}
};

try {
	run();
} catch ( err ) {
	console.error( err );
	process.exitCode = 1;
}
