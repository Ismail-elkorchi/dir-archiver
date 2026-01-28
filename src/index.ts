'use strict';

import * as path from 'path';
import * as fs from 'fs';
import archiver from 'archiver';

class DirArchiver {
	private excludes: string[];
	private directoryPath: string;
	private zipPath: string;
	private includeBaseDirectory: boolean;
	private followSymlinks: boolean;
	private baseDirectory: string;
	private visitedDirectories: Set<string>;
	private output!: fs.WriteStream;
	private archive!: archiver.Archiver;

	/**
	 * The constructor.
	 * @param directoryPath - the path of the folder to archive.
	 * @param zipPath - The path of the zip file to create.
	 * @param includeBaseDirectory - Includes a base directory at the root of the archive. For example, if the root folder of your project is named "your-project", setting includeBaseDirectory to true will create an archive that includes this base directory. If this option is set to false the archive created will unzip its content to the current directory.
	 * @param excludes - The name of the files and foldes to exclude.
	 */
	constructor(
		directoryPath: string,
		zipPath: string,
		includeBaseDirectory = false,
		excludes: string[] = [],
		followSymlinks = false
	) {
		// Contains the excluded files and folders.
		this.excludes = excludes.map( ( element ) => {
			return path.normalize( element );
		} );

		this.directoryPath = path.resolve( directoryPath );
		this.zipPath = path.resolve( zipPath );
		this.includeBaseDirectory = includeBaseDirectory;
		this.followSymlinks = followSymlinks;
		this.baseDirectory = path.basename( this.directoryPath );
		this.visitedDirectories = new Set();

		const relativeZipPath = path.relative( this.directoryPath, this.zipPath );
		const isZipInsideSource = relativeZipPath.length > 0
			&& ! relativeZipPath.startsWith( '..' )
			&& ! path.isAbsolute( relativeZipPath );
		if ( isZipInsideSource ) {
			const normalizedZipPath = path.normalize( relativeZipPath );
			if ( ! this.excludes.includes( normalizedZipPath ) ) {
				this.excludes.push( normalizedZipPath );
			}
		}
	}

	/**
	 * Recursively traverse the directory tree and append the files to the archive.
	 * @param directoryPath - The path of the directory being looped through.
	 */
	private traverseDirectoryTree( directoryPath: string ): void {
		if ( this.followSymlinks ) {
			try {
				const realPath = fs.realpathSync( directoryPath );
				if ( this.visitedDirectories.has( realPath ) ) {
					return;
				}
				this.visitedDirectories.add( realPath );
			} catch {
				return;
			}
		}

		const files = fs.readdirSync( directoryPath );
		for ( const file of files ) {
			const currentPath = path.join( path.resolve( directoryPath ), file );
			if ( path.resolve( currentPath ) === this.zipPath ) {
				continue;
			}
			const relativePath = path.relative( this.directoryPath, currentPath );
			if ( this.excludes.includes( relativePath ) ) {
				continue;
			}
			let stats: fs.Stats;
			try {
				const lstats = fs.lstatSync( currentPath );
				if ( lstats.isSymbolicLink() ) {
					if ( ! this.followSymlinks ) {
						continue;
					}
					stats = fs.statSync( currentPath );
				} else {
					stats = lstats;
				}
			} catch {
				continue;
			}

			if ( stats.isFile() ) {
				if ( this.includeBaseDirectory ) {
					this.archive.file( currentPath, {
						name: path.join( this.baseDirectory, relativePath )
					} );
				} else {
					this.archive.file( currentPath, {
						name: relativePath
					} );
				}
			} else if ( stats.isDirectory() ) {
				this.traverseDirectoryTree( currentPath );
			}
		}
	}

	private prettyBytes( bytes: number ): string {
		if ( bytes > 1000 && bytes < 1000000 ) {
			const kiloBytes = Math.round( ( ( bytes / 1000 ) + Number.EPSILON ) * 100 ) / 100;
			return `${kiloBytes} KB`;
		}
		if ( bytes > 1000000 && bytes < 1000000000 ) {
			const megaBytes = Math.round( ( ( bytes / 1000000 ) + Number.EPSILON ) * 100 ) / 100;
			return `${megaBytes} MB`;
		}
		if ( bytes > 1000000000 ) {
			const gigaBytes = Math.round( ( ( bytes / 1000000000 ) + Number.EPSILON ) * 100 ) / 100;
			return `${gigaBytes} GB`;
		}
		return `${bytes} bytes`;
	}

	createZip(): Promise<string> {
		return new Promise( ( resolve, reject ) => {
			let settled = false;
			const safeResolve = ( value: string ) => {
				if ( settled ) {
					return;
				}
				settled = true;
				resolve( value );
			};
			const safeReject = ( err: unknown ) => {
				if ( settled ) {
					return;
				}
				settled = true;
				const normalizedError = err instanceof Error ? err : new Error( String( err ) );
				reject( normalizedError );
			};

			// Remove the destination zip if it exists.
			// see : https://github.com/Ismail-elkorchi/dir-archiver/issues/5
			try {
				if ( fs.existsSync( this.zipPath ) ) {
					fs.unlinkSync( this.zipPath );
				}
			} catch ( err ) {
				safeReject( err );
				return;
			}

			// Create a file to stream archive data to.
			this.output = fs.createWriteStream( this.zipPath );
			this.archive = archiver( 'zip', {
				zlib: { level: 9 }
			} );

			// Catch warnings during archiving.
			this.archive.on( 'warning', ( err: Error & { code?: string } ) => {
				if ( err.code === 'ENOENT' ) {
					// log warning
					console.log( err );
				} else {
					safeReject( err );
				}
			} );

			// Catch errors during archiving.
			this.archive.on( 'error', ( err ) => {
				safeReject( err );
			} );

			this.output.on( 'error', ( err ) => {
				safeReject( err );
			} );

			// Listen for all archive data to be written.
			this.output.on( 'close', () => {
				console.log( `Created ${this.zipPath} of ${this.prettyBytes( this.archive.pointer() )}` );
				safeResolve( this.zipPath );
			} );

			// Pipe archive data to the file.
			this.archive.pipe( this.output );

			// Recursively traverse the directory tree and append the files to the archive.
			this.visitedDirectories.clear();
			this.traverseDirectoryTree( this.directoryPath );

			// Finalize the archive.
			void this.archive.finalize();
		} );
	}
}

export = DirArchiver;
