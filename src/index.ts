'use strict';

import * as path from 'path';
import * as fs from 'fs';
import archiver from 'archiver';

class DirArchiver {
	private excludedPaths: Set<string>;
	private excludedNames: Set<string>;
	private directoryPath: string;
	private zipPath: string;
	private includeBaseDirectory: boolean;
	private followSymlinks: boolean;
	private baseDirectory: string;
	private visitedDirectories: Set<string>;

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
		this.excludedPaths = new Set();
		this.excludedNames = new Set();
		for ( const excludeRaw of excludes ) {
			const normalizedExclude = path.normalize( excludeRaw.replace( /\\/g, path.sep ) );
			if ( normalizedExclude.length === 0 ) {
				continue;
			}
			const hasSeparator = normalizedExclude.includes( '/' )
				|| normalizedExclude.includes( '\\' )
				|| normalizedExclude.includes( path.sep );
			const trimmedExclude = normalizedExclude.replace( /[\\/]+$/g, '' );
			if ( trimmedExclude.length === 0 ) {
				continue;
			}
			this.excludedPaths.add( trimmedExclude );
			if ( ! hasSeparator ) {
				this.excludedNames.add( trimmedExclude );
			}
		}

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
			this.excludedPaths.add( normalizedZipPath );
		}
	}

	/**
	 * Recursively traverse the directory tree and append the files to the archive.
	 * @param directoryPath - The path of the directory being looped through.
	 */
	private traverseDirectoryTree( directoryPath: string, archive: archiver.Archiver ): void {
		const directoriesToVisit: string[] = [ directoryPath ];

		while ( directoriesToVisit.length > 0 ) {
			const nextDirectory = directoriesToVisit.pop();
			if ( ! nextDirectory ) {
				continue;
			}

			if ( this.followSymlinks ) {
				try {
					const realPath = fs.realpathSync( nextDirectory );
					if ( this.visitedDirectories.has( realPath ) ) {
						continue;
					}
					this.visitedDirectories.add( realPath );
				} catch {
					continue;
				}
			}

			const resolvedDirectoryPath = path.resolve( nextDirectory );
			const entries = fs.readdirSync( resolvedDirectoryPath, { withFileTypes: true } );
			for ( const entry of entries ) {
				const currentPath = path.join( resolvedDirectoryPath, entry.name );
				if ( currentPath === this.zipPath ) {
					continue;
				}
				const relativePath = path.relative( this.directoryPath, currentPath );
				const normalizedRelativePath = path.normalize( relativePath );
				const archiveRelativePath = normalizedRelativePath.replace( /\\/g, '/' );
				const baseName = path.basename( normalizedRelativePath );
				if ( this.excludedPaths.has( normalizedRelativePath ) || this.excludedNames.has( baseName ) ) {
					continue;
				}
				if ( entry.isFile() ) {
					if ( this.includeBaseDirectory ) {
						archive.file( currentPath, {
							name: path.posix.join( this.baseDirectory, archiveRelativePath )
						} );
					} else {
						archive.file( currentPath, {
							name: archiveRelativePath
						} );
					}
				} else if ( entry.isDirectory() ) {
					directoriesToVisit.push( currentPath );
				} else if ( entry.isSymbolicLink() ) {
					if ( ! this.followSymlinks ) {
						continue;
					}
					let stats: fs.Stats;
					try {
						stats = fs.statSync( currentPath );
					} catch {
						continue;
					}
					if ( stats.isFile() ) {
						if ( this.includeBaseDirectory ) {
							archive.file( currentPath, {
								name: path.posix.join( this.baseDirectory, archiveRelativePath )
							} );
						} else {
							archive.file( currentPath, {
								name: archiveRelativePath
							} );
						}
					} else if ( stats.isDirectory() ) {
						directoriesToVisit.push( currentPath );
					}
				}
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
			let output: fs.WriteStream | null = null;
			let archive: archiver.Archiver | null = null;
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
				try {
					if ( archive ) {
						archive.abort();
					}
				} catch {
					// Ignore abort errors.
				}
				try {
					if ( output ) {
						output.destroy();
					}
				} catch {
					// Ignore destroy errors.
				}
				try {
					if ( fs.existsSync( this.zipPath ) ) {
						fs.unlinkSync( this.zipPath );
					}
				} catch {
					// Ignore cleanup errors.
				}
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
			output = fs.createWriteStream( this.zipPath );
			archive = archiver( 'zip', {
				zlib: { level: 9 }
			} );

			// Catch warnings during archiving.
			archive.on( 'warning', ( err: Error & { code?: string } ) => {
				if ( err.code === 'ENOENT' ) {
					// log warning
					console.log( err );
				} else {
					safeReject( err );
				}
			} );

			// Catch errors during archiving.
			archive.on( 'error', ( err ) => {
				safeReject( err );
			} );

			output.on( 'error', ( err ) => {
				safeReject( err );
			} );

			// Listen for all archive data to be written.
			output.on( 'close', () => {
				if ( settled ) {
					return;
				}
				console.log( `Created ${this.zipPath} of ${this.prettyBytes( archive.pointer() )}` );
				safeResolve( this.zipPath );
			} );

			// Pipe archive data to the file.
			archive.pipe( output );

			// Recursively traverse the directory tree and append the files to the archive.
			this.visitedDirectories.clear();
			try {
				this.traverseDirectoryTree( this.directoryPath, archive );
			} catch ( err ) {
				safeReject( err );
				return;
			}

			// Finalize the archive.
			void Promise.resolve( archive.finalize() ).catch( ( err: unknown ) => {
				safeReject( err );
			} );
		} );
	}
}

export = DirArchiver;
