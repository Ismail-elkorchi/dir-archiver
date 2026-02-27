#!/usr/bin/env node

import DirArchiver from './index.js';
import { parseCliArgs } from './cli-args.js';

const usage = ` Dir Archiver could not be executed. Some arguments are missing.

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
      --exclude        A list with the names of the files and folders to exclude.               [array]`;

const run = async (): Promise<void> => {
	const parsedArgs = await parseCliArgs( process.argv.slice( 2 ) );

	if (
		! parsedArgs.hasRequiredPaths
		|| typeof parsedArgs.directoryPath !== 'string'
		|| typeof parsedArgs.zipPath !== 'string'
	) {
		console.log( usage );
		process.exitCode = 1;
		return;
	}

	const archive = new DirArchiver(
		parsedArgs.directoryPath,
		parsedArgs.zipPath,
		parsedArgs.includeBaseDirectory,
		parsedArgs.excludes,
		parsedArgs.followSymlinks
	);
	await archive.createZip();
};

void run().catch( ( err: unknown ) => {
	const normalizedError = err instanceof Error ? err : new Error( String( err ) );
	console.error( normalizedError );
	process.exitCode = 1;
} );
