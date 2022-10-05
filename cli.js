#!/usr/bin/env node

import DirArchiver from './index.js';

const processArguments = process.argv;
var directoryPath = '';
var zipPath = '';
var includeBaseDirectory = true;
var excludes = [];

if ( ! processArguments.includes( '--src' ) || ! processArguments.includes( '--dest' ) ) {
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
      --exclude        A list with the names of the files and folders to exclude.               [array]` );
	process.exit(); // eslint-disable-line n/no-process-exit
}

for ( const argumentIndex in processArguments ) {
	if ( processArguments[argumentIndex] === '--src' ) {
		directoryPath = processArguments[parseInt( argumentIndex ) + 1];
	}
	if ( processArguments[argumentIndex] === '--dest' ) {
		zipPath = processArguments[parseInt( argumentIndex ) + 1];
	}
	if ( processArguments[argumentIndex] === '--includebasedir' ) {
		includeBaseDirectory = ( processArguments[parseInt( argumentIndex ) + 1] === 'true' );
	}
	if ( afterExclude === true ) {
		excludes.push( processArguments[argumentIndex] );
	}
	if ( processArguments[argumentIndex] === '--exclude' ) {
		var afterExclude = true;
	}
}

const archive = new DirArchiver( directoryPath, zipPath, includeBaseDirectory, excludes );
archive.createZip();
