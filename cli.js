#!/usr/bin/env node

var DirArchiver = require('./index');

const arguments = process.argv;
var directoryPath = '';
var zipPath = '';
var excludes = [];

if ( ! arguments.includes( '--src' ) || ! arguments.includes( '--dest' ) ) {
    console.log(` Dir Archiver could not be executed. Some arguments are missing.

    Options:
      --src      The path of the folder to archive.                          [string][required]
      --dest     The path of the zip file to create.                         [string][required]
      --exclude  A list with the names of the files and folders to exclude.             [array]`);
    process.exit();
}

for ( argumentIndex in arguments ) {
    if( arguments[argumentIndex] === '--src' ) {
        directoryPath = arguments[parseInt(argumentIndex) + 1];
    }
    if( arguments[argumentIndex] === '--dest' ) {
        zipPath = arguments[parseInt(argumentIndex) + 1];
    }
    if( afterExclude === true ) {
        excludes.push( arguments[argumentIndex] );
    }
    if( arguments[argumentIndex] === '--exclude' ) {
        var afterExclude = true;
    }
}

const archive = new DirArchiver(directoryPath, zipPath, excludes);
archive.createZip();