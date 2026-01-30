import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yauzl from 'yauzl';
import { createArchive, DirArchiver } from '../dist/index.js';

const isWindows = process.platform === 'win32';

const originalWin32Normalize = path.win32.normalize;

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

const listZipEntriesRaw = ( zipPath ) => new Promise( ( resolve, reject ) => {
	yauzl.open( zipPath, { lazyEntries: true }, ( err, zipfile ) => {
		if ( err ) {
			reject( err );
			return;
		}

		const entries = [];

		zipfile.on( 'entry', ( entry ) => {
			entries.push( entry.fileName );
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
		fs.writeFileSync( path.join( src, 'a-order.txt' ), 'a' );
		fs.writeFileSync( path.join( src, 'z-order.txt' ), 'z' );
		fs.writeFileSync( path.join( nested, 'nested.txt' ), 'nested' );
		fs.writeFileSync( path.join( nested, 'root.txt' ), 'nested-root' );
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
		await createArchive( {
			sourceDir: src,
			destZip: destInside,
			includeBaseDirectory: false,
			excludes: [ 'nested' ]
		} );

		assert.ok( fs.existsSync( destInside ), 'archive should be created' );

		const entriesInside = await listZipEntries( destInside );
		assert.ok( entriesInside.includes( 'root.txt' ), 'root.txt should be included' );
		const orderIndexA = entriesInside.indexOf( 'a-order.txt' );
		const orderIndexZ = entriesInside.indexOf( 'z-order.txt' );
		assert.ok( orderIndexA !== -1 && orderIndexZ !== -1, 'order files should be included' );
		assert.ok( orderIndexA < orderIndexZ, 'archive entries should be deterministic' );
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
		await createArchive( {
			sourceDir: src,
			destZip: destExclude,
			includeBaseDirectory: false,
			excludes: [ fileExcludePath ]
		} );
		const entriesExclude = await listZipEntries( destExclude );
		assert.ok( entriesExclude.includes( 'nested/nested.txt' ), 'nested.txt should be included when only excluding skip.txt' );
		assert.ok( ! entriesExclude.includes( 'nested/skip.txt' ), 'skip.txt should be excluded by file path' );

		const absoluteSkipPath = path.join( nested, 'skip.txt' );
		const destAbsoluteExclude = path.join( tmpRoot, 'absolute-exclude.zip' );
		await createArchive( {
			sourceDir: src,
			destZip: destAbsoluteExclude,
			includeBaseDirectory: false,
			excludes: [ absoluteSkipPath ]
		} );
		const entriesAbsoluteExclude = await listZipEntries( destAbsoluteExclude );
		assert.ok( ! entriesAbsoluteExclude.includes( 'nested/skip.txt' ), 'absolute exclude path should remove nested skip file' );
		assert.ok( entriesAbsoluteExclude.includes( 'nested/nested.txt' ), 'absolute exclude path should not remove nested.txt' );

		const destDeep = path.join( tmpRoot, 'deep.zip' );
		await createArchive( {
			sourceDir: src,
			destZip: destDeep,
			includeBaseDirectory: false
		} );
		const entriesDeep = await listZipEntries( destDeep );
		const deepRelative = normalizeEntry( path.relative( src, deepFilePath ) );
		assert.ok( entriesDeep.includes( deepRelative ), 'deep file should be included' );

		const destNameExclude = path.join( tmpRoot, 'name-exclude.zip' );
		await createArchive( {
			sourceDir: src,
			destZip: destNameExclude,
			includeBaseDirectory: false,
			excludes: [ 'cache' ]
		} );
		const entriesNameExclude = await listZipEntries( destNameExclude );
		assert.ok( ! entriesNameExclude.includes( 'cache/cache.txt' ), 'cache directory should be excluded by name' );
		assert.ok( ! entriesNameExclude.includes( 'nested/cache/nested-cache.txt' ), 'nested cache directory should be excluded by name' );

		const destNameExcludeFile = path.join( tmpRoot, 'name-exclude-file.zip' );
		await createArchive( {
			sourceDir: src,
			destZip: destNameExcludeFile,
			includeBaseDirectory: false,
			excludes: [ 'root.txt' ]
		} );
		const entriesNameExcludeFile = await listZipEntries( destNameExcludeFile );
		assert.ok( ! entriesNameExcludeFile.includes( 'root.txt' ), 'root.txt should be excluded by name' );
		assert.ok( ! entriesNameExcludeFile.includes( 'nested/root.txt' ), 'nested root.txt should be excluded by name' );

		if ( isWindows ) {
			const destCaseInsensitive = path.join( tmpRoot, 'case-insensitive.zip' );
			await createArchive( {
				sourceDir: src,
				destZip: destCaseInsensitive,
				includeBaseDirectory: false,
				excludes: [ 'ROOT.TXT' ]
			} );
			const entriesCaseInsensitive = await listZipEntries( destCaseInsensitive );
			assert.ok( ! entriesCaseInsensitive.includes( 'root.txt' ), 'Windows excludes should be case-insensitive for names' );
		}

		const destPathExclude = path.join( tmpRoot, 'path-exclude.zip' );
		await createArchive( {
			sourceDir: src,
			destZip: destPathExclude,
			includeBaseDirectory: false,
			excludes: [ 'cache/' ]
		} );
		const entriesPathExclude = await listZipEntries( destPathExclude );
		assert.ok( ! entriesPathExclude.includes( 'cache/cache.txt' ), 'root cache directory should be excluded by path' );
		assert.ok( entriesPathExclude.includes( 'nested/cache/nested-cache.txt' ), 'nested cache directory should remain when excluding root cache by path' );

		const destWindowsExclude = path.join( tmpRoot, 'windows-exclude.zip' );
		await createArchive( {
			sourceDir: src,
			destZip: destWindowsExclude,
			includeBaseDirectory: false,
			excludes: [ 'nested\\\\skip.txt', 'cache\\\\' ]
		} );
		const entriesWindowsExclude = await listZipEntries( destWindowsExclude );
		assert.ok( ! entriesWindowsExclude.includes( 'nested/skip.txt' ), 'windows-style path should exclude nested skip file' );
		assert.ok( ! entriesWindowsExclude.includes( 'cache/cache.txt' ), 'windows-style path should exclude root cache directory' );
		assert.ok( entriesWindowsExclude.includes( 'nested/cache/nested-cache.txt' ), 'windows-style path should not exclude nested cache directory' );

		const destWindowsMixedExclude = path.join( tmpRoot, 'windows-mixed-exclude.zip' );
		const windowsNestedCache = `${path.win32.join( 'nested', 'cache' )}\\`;
		const windowsSkip = `.\\${path.win32.join( 'nested', 'skip.txt' )}`;
		await createArchive( {
			sourceDir: src,
			destZip: destWindowsMixedExclude,
			includeBaseDirectory: false,
			excludes: [ windowsNestedCache, windowsSkip ]
		} );
		const entriesWindowsMixedExclude = await listZipEntries( destWindowsMixedExclude );
		assert.ok( ! entriesWindowsMixedExclude.includes( 'nested/cache/nested-cache.txt' ), 'windows-style mixed separators should exclude nested cache directory' );
		assert.ok( ! entriesWindowsMixedExclude.includes( 'nested/skip.txt' ), 'windows-style mixed separators should exclude nested skip file' );
		assert.ok( entriesWindowsMixedExclude.includes( 'cache/cache.txt' ), 'windows-style nested path should not exclude root cache directory' );
		assert.ok( entriesWindowsMixedExclude.includes( 'nested/nested.txt' ), 'windows-style nested path should not exclude sibling files' );

		if ( symlinkCreated || symlinkDirCreated || loopSymlinkCreated ) {
			const destFollow = path.join( tmpRoot, 'follow.zip' );
			await createArchive( {
				sourceDir: src,
				destZip: destFollow,
				includeBaseDirectory: false,
				followSymlinks: true
			} );
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

		const destMissingDir = path.join( tmpRoot, 'missing-dir', 'archive.zip' );
		await assert.rejects( async () => {
			await createArchive( {
				sourceDir: src,
				destZip: destMissingDir,
				includeBaseDirectory: false
			} );
		}, /ENOENT/ );
		assert.ok( ! fs.existsSync( destMissingDir ), 'archive should not be created when destination directory is missing' );

		const missingSource = path.join( tmpRoot, 'missing-src' );
		const destMissingSource = path.join( tmpRoot, 'missing-src.zip' );
		await assert.rejects( async () => {
			await createArchive( {
				sourceDir: missingSource,
				destZip: destMissingSource,
				includeBaseDirectory: false
			} );
		}, /ENOENT/ );
		assert.ok( ! fs.existsSync( destMissingSource ), 'archive should be cleaned up when source directory is missing' );

		const destOutside = path.join( tmpRoot, 'outside.zip' );
		await createArchive( {
			sourceDir: src,
			destZip: destOutside,
			includeBaseDirectory: true
		} );

		const entriesOutside = await listZipEntries( destOutside );
		const baseName = path.basename( src );
		const expectedBaseEntry = `${baseName}/root.txt`;
		assert.ok( entriesOutside.includes( expectedBaseEntry ), 'base directory should be included' );
		assert.ok( ! entriesOutside.includes( 'root.txt' ), 'root.txt should not be at archive root' );

		const destOutsideSymlink = path.join( tmpRoot, 'outside-symlink.zip' );
		await createArchive( {
			sourceDir: src,
			destZip: destOutsideSymlink,
			includeBaseDirectory: true,
			followSymlinks: true
		} );
		const entriesOutsideSymlink = await listZipEntries( destOutsideSymlink );
		assert.ok( entriesOutsideSymlink.includes( `${baseName}/root.txt` ), 'base directory should still be included when following symlinks' );
		if ( symlinkCreated ) {
			assert.ok( entriesOutsideSymlink.includes( `${baseName}/external-link.txt` ), 'symlinks should be included under the base directory when following' );
		}

		const rawEntriesOutsideSymlink = await listZipEntriesRaw( destOutsideSymlink );
		assert.ok( ! rawEntriesOutsideSymlink.some( ( entry ) => entry.includes( '\\\\' ) ), 'archive entries should use forward slashes' );

		if ( ! isWindows ) {
			const lockedDir = path.join( src, 'locked' );
			fs.mkdirSync( lockedDir );
			fs.writeFileSync( path.join( lockedDir, 'secret.txt' ), 'secret' );
			fs.chmodSync( lockedDir, 0 );

			const destLocked = path.join( tmpRoot, 'locked.zip' );
			await assert.rejects( async () => {
				await createArchive( {
					sourceDir: src,
					destZip: destLocked,
					includeBaseDirectory: false
				} );
			} );

			fs.chmodSync( lockedDir, 0o755 );

			const readOnlyDir = path.join( tmpRoot, 'readonly' );
			fs.mkdirSync( readOnlyDir );
			fs.chmodSync( readOnlyDir, 0o555 );
			const destReadOnly = path.join( readOnlyDir, 'archive.zip' );
			await assert.rejects( async () => {
				await createArchive( {
					sourceDir: src,
					destZip: destReadOnly,
					includeBaseDirectory: false
				} );
			} );
			assert.ok( ! fs.existsSync( destReadOnly ), 'archive should not exist when destination is not writable' );
			fs.chmodSync( readOnlyDir, 0o755 );

			const unreadableFile = path.join( src, 'unreadable.txt' );
			fs.writeFileSync( unreadableFile, 'secret' );
			fs.chmodSync( unreadableFile, 0 );
			const destUnreadable = path.join( tmpRoot, 'unreadable.zip' );
			await assert.rejects( async () => {
				await createArchive( {
					sourceDir: src,
					destZip: destUnreadable,
					includeBaseDirectory: false
				} );
			} );
			assert.ok( ! fs.existsSync( destUnreadable ), 'archive should be cleaned up when a file is unreadable' );
			fs.chmodSync( unreadableFile, 0o644 );
		}

		if ( ! isWindows ) {
			const destWinNormalize = path.join( tmpRoot, 'win-normalize.zip' );
			const winArchive = new DirArchiver( src, destWinNormalize, false, [] );
			const winNormalizeCalled = [];
			path.win32.normalize = ( value ) => {
				winNormalizeCalled.push( value );
				return originalWin32Normalize( value );
			};
			await winArchive.createZip();
			path.win32.normalize = originalWin32Normalize;
			assert.ok( winNormalizeCalled.length === 0, 'path.win32.normalize should not be used during archiving' );
		}
	} finally {
		path.win32.normalize = originalWin32Normalize;
		removeDir( tmpRoot );
	}
};

run().catch( ( err ) => {
	console.error( err );
	process.exitCode = 1;
} );
