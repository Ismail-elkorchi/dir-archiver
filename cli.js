#!/usr/bin/env node

const DirArchiver = require( './index' );
const parseArgs = require( 'argv-flags' );

const directoryPath = parseArgs( '--src', 'string' );
const zipPath = parseArgs( '--dest', 'string' );
const includeBaseDirectory = parseArgs( '--includebasedir', 'boolean' );
const excludes = parseArgs( '--exclude', 'array' ) || [];

if ( directoryPath === false || zipPath === false ) {
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

const archive = new DirArchiver( directoryPath, zipPath, includeBaseDirectory, excludes );
archive.createZip();