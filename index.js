'use strict';

import { normalize, resolve, basename, join, relative } from 'path';
import { readdirSync, statSync, existsSync, unlinkSync, createWriteStream } from 'fs';
import archiver from 'archiver';

class DirArchiver {
	/**
	 * The constructor.
	 * @param {string} directoryPath - the path of the folder to archive.
	 * @param {string} zipPath - The path of the zip file to create.
	 * @param {Boolean} includeBaseDirectory - Includes a base directory at the root of the archive. For example, if the root folder of your project is named "your-project", setting includeBaseDirectory to true will create an archive that includes this base directory. If this option is set to false the archive created will unzip its content to the current directory.
	 * @param {array} excludes - The name of the files and foldes to exclude.
	 */
	constructor( directoryPath, zipPath, includeBaseDirectory, excludes ) {

		// Contains the excluded files and folders.
		this.excludes = excludes.map( ( element ) => {
			return normalize( element );
		} );

		this.directoryPath = resolve( directoryPath );

		this.zipPath = resolve( zipPath );

		this.includeBaseDirectory = includeBaseDirectory;

		this.baseDirectory = basename( this.directoryPath );
	}

	/**
	 * Recursively traverse the directory tree and append the files to the archive.
	 * @param {string} directoryPath - The path of the directory being looped through.
	 */
	traverseDirectoryTree( directoryPath ) {
		const files = readdirSync( directoryPath );
		for ( const i in files ) {
			const currentPath = join( resolve( directoryPath ), files[ i ] );
			const stats = statSync( currentPath );
			let relativePath = relative( this.directoryPath, currentPath );
			if ( stats.isFile() && ! this.excludes.includes( relativePath ) ) {
				if ( this.includeBaseDirectory === true ) {
					this.archive.file( currentPath, {
						name: join( this.baseDirectory, relativePath )
					} );
				} else {
					this.archive.file( currentPath, {
						name: relativePath
					} );
				}
			} else if ( stats.isDirectory() && ! this.excludes.includes( relativePath ) ) {
				this.traverseDirectoryTree( currentPath );
			}
		}
	}

	prettyBytes( bytes ) {
		if ( bytes > 1000 && bytes < 1000000 ) {
			return Math.round( ( ( bytes / 1000 ) + Number.EPSILON ) * 100 ) / 100 + ' KB';
		}
		if ( bytes > 1000000 && bytes < 1000000000 ) {
			return Math.round( ( ( bytes / 1000000 ) + Number.EPSILON ) * 100 ) / 100 + ' MB';
		}
		if ( bytes > 1000000000 ) {
			return Math.round( ( ( bytes / 1000000000 ) + Number.EPSILON ) * 100 ) / 100 + ' GB';
		}
		return bytes + ' bytes';
	}

	createZip () {
		// Remove the destination zip if it exists.
		// see : https://github.com/Ismail-elkorchi/dir-archiver/issues/5
		if ( existsSync( this.zipPath ) ) {
			unlinkSync( this.zipPath );
		}
		// Create a file to stream archive data to.
		this.output = createWriteStream( this.zipPath );
		this.archive = archiver( 'zip', {
			zlib: { level: 9 }
		} );

		// Catch warnings during archiving.
		this.archive.on( 'warning', function( err ) {
			if ( err.code === 'ENOENT' ) {
				// log warning
				console.log( err );
			} else {
				// throw error
				throw err;
			}
		} );

		// Catch errors during archiving.
		this.archive.on( 'error', function( err ) {
			throw err;
		} );

		// Pipe archive data to the file.
		this.archive.pipe( this.output );

		// Recursively traverse the directory tree and append the files to the archive.
		this.traverseDirectoryTree( this.directoryPath );

		// Finalize the archive.
		this.archive.finalize();

		const self = this;
		// Listen for all archive data to be written.
		this.output.on( 'close', function () {
			console.log( `Created ${self.zipPath} of ${self.prettyBytes( self.archive.pointer() )}` );
		} );
	}
}
export default DirArchiver;
