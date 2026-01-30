#!/usr/bin/env node

import { defineSchema, parseArgs } from 'argv-flags';
import { createArchive } from './archive.js';

const schema = defineSchema({
	src: { type: 'string', flags: [ '--src' ], required: true },
	dest: { type: 'string', flags: [ '--dest' ], required: true },
	includeBaseDir: { type: 'boolean', flags: [ '--includebasedir' ], default: false },
	followSymlinks: { type: 'boolean', flags: [ '--followsymlinks' ], default: false },
	exclude: { type: 'array', flags: [ '--exclude' ], default: [] },
	json: { type: 'boolean', flags: [ '--json' ], default: false },
	manifest: { type: 'boolean', flags: [ '--manifest' ], default: false }
});

const formatBytes = ( bytes: bigint ) => {
	const maxSafe = BigInt( Number.MAX_SAFE_INTEGER );
	if ( bytes > maxSafe ) {
		return `${bytes.toString()} bytes`;
	}
	const numeric = Number( bytes );
	if ( numeric < 1000 ) {
		return `${numeric} bytes`;
	}
	if ( numeric < 1_000_000 ) {
		return `${Math.round( ( numeric / 1000 + Number.EPSILON ) * 100 ) / 100} KB`;
	}
	if ( numeric < 1_000_000_000 ) {
		return `${Math.round( ( numeric / 1_000_000 + Number.EPSILON ) * 100 ) / 100} MB`;
	}
	return `${Math.round( ( numeric / 1_000_000_000 + Number.EPSILON ) * 100 ) / 100} GB`;
};

const jsonReplacer = ( _key: string, value: unknown ) =>
	typeof value === 'bigint' ? value.toString() : value;

const usage = ` Dir Archiver could not be executed. Some arguments are missing or invalid.

    Options:
      --src            The path of the folder to archive.                            [string][required]
      --dest           The path of the zip file to create.                           [string][required]
      --includebasedir Includes a base directory at the root of the archive.                         [bool]
      --followsymlinks Follow symlinks when traversing directories.                              [bool]
      --exclude        A list with the names of the files and folders to exclude.               [array]
      --json           Output machine-readable JSON.                                            [bool]
      --manifest       Include entry metadata in JSON output.                                   [bool]`;

const result = parseArgs( schema );
const wantsJson = result.values.json === true;

if ( ! result.ok ) {
	if ( wantsJson ) {
		console.log( JSON.stringify( {
			ok: false,
			issues: result.issues,
			unknown: result.unknown,
			rest: result.rest
		}, jsonReplacer ) );
	} else {
		console.log( usage );
		if ( result.issues.length > 0 ) {
			console.log( '\nIssues:' );
			for ( const issue of result.issues ) {
				console.log( `  - ${issue.code}: ${issue.message}` );
			}
		}
	}
	process.exitCode = 1;
} else {
	const src = result.values.src;
	const dest = result.values.dest;
	if ( typeof src !== 'string' || typeof dest !== 'string' ) {
		const error = new Error( 'Missing required flags.' );
		if ( wantsJson ) {
			console.log( JSON.stringify( { ok: false, error: { name: error.name, message: error.message } }, jsonReplacer ) );
		} else {
			console.error( error );
		}
		process.exitCode = 1;
	} else {
		const reportMode = result.values.manifest === true ? 'manifest' : 'summary';
		const excludes = Array.isArray( result.values.exclude ) ? result.values.exclude : [];
		createArchive( {
			sourceDir: src,
			destZip: dest,
			includeBaseDirectory: result.values.includeBaseDir === true,
			followSymlinks: result.values.followSymlinks === true,
			excludes,
			report: reportMode
		} ).then( ( report ) => {
			if ( wantsJson ) {
				console.log( JSON.stringify( { ok: true, report }, jsonReplacer ) );
			} else {
				console.log(
					`Created ${report.zipPath} of ${formatBytes( report.archiveBytes )} `
					+ `(entries: ${report.entryCount}, uncompressed: ${formatBytes( report.totalBytes )})`
				);
			}
		} ).catch( ( err: unknown ) => {
			const normalizedError = err instanceof Error ? err : new Error( String( err ) );
			if ( wantsJson ) {
				console.log( JSON.stringify( {
					ok: false,
					error: {
						name: normalizedError.name,
						message: normalizedError.message
					}
				}, jsonReplacer ) );
			} else {
				console.error( normalizedError );
			}
			process.exitCode = 1;
		} );
	}
}
