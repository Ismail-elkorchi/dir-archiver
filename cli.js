#!/usr/bin/env node

var DirArchiver = require('./index');

const arguments = process.argv;
var directoryPath = '';
var zipPath = '';
var excludes = [];

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