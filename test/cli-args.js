'use strict';

const assert = require( 'assert' );

const run = async () => {
	const { parseCliArgs } = await import( '../dist/cli-args.js' );

	const minimal = await parseCliArgs( [ '--src', 'source', '--dest', 'archive.zip' ] );
	assert.strictEqual( minimal.hasRequiredPaths, true, 'required args should parse' );
	assert.strictEqual( minimal.directoryPath, 'source' );
	assert.strictEqual( minimal.zipPath, 'archive.zip' );
	assert.strictEqual( minimal.includeBaseDirectory, false, 'includeBaseDirectory should default to false' );
	assert.strictEqual( minimal.followSymlinks, false, 'followSymlinks should default to false' );
	assert.deepStrictEqual( minimal.excludes, [], 'excludes should default to an empty array' );

	const explicitBooleans = await parseCliArgs( [
		'--src', 'source',
		'--dest', 'archive.zip',
		'--includebasedir=true',
		'--followsymlinks=false'
	] );
	assert.strictEqual( explicitBooleans.includeBaseDirectory, true, 'includebasedir=true should parse as true' );
	assert.strictEqual( explicitBooleans.followSymlinks, false, 'followsymlinks=false should parse as false' );

	const mixedExcludes = await parseCliArgs( [
		'--src', 'source',
		'--dest', 'archive.zip',
		'--exclude=cache',
		'--exclude', '.\\nested\\skip.txt',
		'nested\\cache\\'
	] );
	assert.deepStrictEqual(
		mixedExcludes.excludes,
		[ 'cache', '.\\nested\\skip.txt', 'nested\\cache\\' ],
		'exclude values should preserve inline and repeated array parsing'
	);

	const withUnknown = await parseCliArgs( [ '--src', 'source', '--dest', 'archive.zip', '--unknown', 'value' ] );
	assert.strictEqual( withUnknown.hasRequiredPaths, true, 'unknown flags should not block required argument parsing' );

	const missingRequired = await parseCliArgs( [ '--dest', 'archive.zip' ] );
	assert.strictEqual( missingRequired.hasRequiredPaths, false, 'missing --src should fail required path check' );
	assert.strictEqual( missingRequired.directoryPath, undefined );
	assert.strictEqual( missingRequired.zipPath, 'archive.zip' );
};

run().catch( ( err ) => {
	console.error( err );
	process.exitCode = 1;
} );
