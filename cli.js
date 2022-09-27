#!/usr/bin/env node

var DirArchiver = require( './index' );

const arguments = process.argv;
var directoryPath = '';
var zipPath = '';
var includeBaseDirectory = true;
var excludes = [];

if ( ! arguments.includes( '--src' ) || ! arguments.includes( '--dest' ) ) {
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
	process.exit();
}

for ( const argumentIndex in arguments ) {
	if ( arguments[argumentIndex] === '--src' ) {
		directoryPath = arguments[parseInt( argumentIndex ) + 1];
	}
	if ( arguments[argumentIndex] === '--dest' ) {
		zipPath = arguments[parseInt( argumentIndex ) + 1];
	}
	if ( arguments[argumentIndex] === '--includebasedir' ) {
		includeBaseDirectory = ( arguments[parseInt( argumentIndex ) + 1] === 'true' );
	}
	if ( afterExclude === true ) {
		excludes.push( arguments[argumentIndex] );
	}
	if ( arguments[argumentIndex] === '--exclude' ) {
		var afterExclude = true;
	}
}

const archive = new DirArchiver( directoryPath, zipPath, includeBaseDirectory, excludes );
archive.createZip();