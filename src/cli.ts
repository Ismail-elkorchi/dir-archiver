#!/usr/bin/env node

import DirArchiver from './index';
import parseArgs from 'argv-flags';

const parseBooleanFlag = ( flag: string ): boolean => {
	const rawValue = parseArgs( flag, 'string' );
	if ( typeof rawValue === 'string' && rawValue.length > 0 && ! rawValue.startsWith( '-' ) ) {
		const normalized = rawValue.toLowerCase();
		if ( normalized === 'true' ) {
			return true;
		}
		if ( normalized === 'false' ) {
			return false;
		}
	}
	return parseArgs( flag, 'boolean' ) === true;
};

const directoryPath = parseArgs( '--src', 'string' );
const zipPath = parseArgs( '--dest', 'string' );
const includeBaseDirectory = parseBooleanFlag( '--includebasedir' );
const followSymlinks = parseBooleanFlag( '--followsymlinks' );
const excludeValues = parseArgs( '--exclude', 'array' );
const excludes = Array.isArray( excludeValues ) ? excludeValues : [];

if ( typeof directoryPath !== 'string' || typeof zipPath !== 'string' ) {
	console.log( ` Dir Archiver could not be executed. Some arguments are missing.

    Options:
      --src            The path of the folder to archive.                            [string][required]
      --dest           The path of the zip file to create.                           [string][required]
      --includebasedir Includes a base directory at the root of the archive.
                       For example, if the root folder of your project is named
                       "your-project", setting this option to true will create
                       an archive that includes this base directory.
                       If this option is set to false the archive created will
                       unzip its content to the current directory.                               [bool]
      --followsymlinks Follow symlinks when traversing directories.                              [bool]
      --exclude        A list with the names of the files and folders to exclude.               [array]` );
	process.exitCode = 1;
} else {
	const archive = new DirArchiver( directoryPath, zipPath, includeBaseDirectory, excludes, followSymlinks );
	archive.createZip().catch( ( err: unknown ) => {
		const normalizedError = err instanceof Error ? err : new Error( String( err ) );
		console.error( normalizedError );
		process.exitCode = 1;
	} );
}
