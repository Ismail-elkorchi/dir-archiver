'use strict';

import * as path from 'node:path';
import * as fs from 'node:fs';

interface ZipWriterLike {
	add: (
		name: string,
		source: string
	) => Promise<void>;
	close: () => Promise<void>;
}

interface ZipWriterFactory {
	toFile: (
		path: string | URL,
		options?: {
			sinkSeekabilityPolicy?: 'auto' | 'on' | 'off';
		}
	) => Promise<ZipWriterLike>;
}

let zipWriterPromise: Promise<ZipWriterFactory> | undefined;

const loadZipWriter = (): Promise<ZipWriterFactory> => {
	zipWriterPromise ??= import( '@ismail-elkorchi/bytefold/node/zip' )
		.then( ( moduleExports ) => moduleExports.ZipWriter as ZipWriterFactory );
	return zipWriterPromise;
};

interface ArchiveFileEntry {
	sourcePath: string;
	archivePath: string;
}

class DirArchiver {
	private excludedPaths: Set<string>;
	private excludedNames: Set<string>;
	private caseInsensitiveExcludes: boolean;
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
		this.directoryPath = path.resolve( directoryPath );
		this.zipPath = path.resolve( zipPath );
		this.includeBaseDirectory = includeBaseDirectory;
		this.followSymlinks = followSymlinks;
		this.baseDirectory = path.basename( this.directoryPath );
		this.visitedDirectories = new Set();
		this.caseInsensitiveExcludes = process.platform === 'win32';

		// Contains the excluded files and folders.
		this.excludedPaths = new Set();
		this.excludedNames = new Set();
		for ( const excludeRaw of excludes ) {
			if ( typeof excludeRaw !== 'string' ) {
				continue;
			}
			const trimmedRaw = excludeRaw.trim();
			if ( trimmedRaw.length === 0 ) {
				continue;
			}
			let normalizedExclude = path.normalize( trimmedRaw.replace( /\\/g, path.sep ) );
			if ( normalizedExclude === '.' || normalizedExclude === path.sep ) {
				continue;
			}
			if ( path.isAbsolute( normalizedExclude ) ) {
				const relativeCandidate = path.relative( this.directoryPath, normalizedExclude );
				const isInsideSource = relativeCandidate.length > 0
					&& ! relativeCandidate.startsWith( '..' )
					&& ! path.isAbsolute( relativeCandidate );
				if ( isInsideSource ) {
					normalizedExclude = path.normalize( relativeCandidate );
				}
			}
			if ( normalizedExclude.length === 0 ) {
				continue;
			}
			const hasSeparator = normalizedExclude.includes( '/' )
				|| normalizedExclude.includes( '\\' )
				|| normalizedExclude.includes( path.sep );
			const trimmedExclude = normalizedExclude.replace( /[\\/]+$/g, '' );
			if ( trimmedExclude.length === 0 || trimmedExclude === '.' ) {
				continue;
			}
			const normalizedValue = this.normalizeExcludeValue( trimmedExclude );
			this.excludedPaths.add( normalizedValue );
			if ( ! hasSeparator ) {
				this.excludedNames.add( normalizedValue );
			}
		}

		const relativeZipPath = path.relative( this.directoryPath, this.zipPath );
		const isZipInsideSource = relativeZipPath.length > 0
			&& ! relativeZipPath.startsWith( '..' )
			&& ! path.isAbsolute( relativeZipPath );
		if ( isZipInsideSource ) {
			const normalizedZipPath = path.normalize( relativeZipPath );
			this.excludedPaths.add( this.normalizeExcludeValue( normalizedZipPath ) );
		}
	}

	/**
	 * Recursively traverse the directory tree and collect files to append to the archive.
	 * @param directoryPath - The path of the directory being looped through.
	 */
	private collectArchiveEntries( directoryPath: string ): ArchiveFileEntry[] {
		const directoriesToVisit: string[] = [ directoryPath ];
		const filesToArchive: ArchiveFileEntry[] = [];

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
			entries.sort( ( firstEntry, secondEntry ) => {
				if ( firstEntry.name < secondEntry.name ) {
					return -1;
				}
				if ( firstEntry.name > secondEntry.name ) {
					return 1;
				}
				return 0;
			} );
			for ( const entry of entries ) {
				const currentPath = path.join( resolvedDirectoryPath, entry.name );
				if ( currentPath === this.zipPath ) {
					continue;
				}
				const relativePath = path.relative( this.directoryPath, currentPath );
				const normalizedRelativePath = path.normalize( relativePath );
				const archiveRelativePath = normalizedRelativePath.replace( /\\/g, '/' );
				const baseName = path.basename( normalizedRelativePath );
				const normalizedPathValue = this.normalizeExcludeValue( normalizedRelativePath );
				const normalizedNameValue = this.normalizeExcludeValue( baseName );
				if ( this.excludedPaths.has( normalizedPathValue ) || this.excludedNames.has( normalizedNameValue ) ) {
					continue;
				}
				if ( entry.isFile() ) {
					filesToArchive.push( {
						sourcePath: currentPath,
						archivePath: this.getArchivePath( archiveRelativePath )
					} );
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
						filesToArchive.push( {
							sourcePath: currentPath,
							archivePath: this.getArchivePath( archiveRelativePath )
						} );
					} else if ( stats.isDirectory() ) {
						directoriesToVisit.push( currentPath );
					}
				}
			}
		}
		return filesToArchive;
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

	private normalizeExcludeValue( value: string ): string {
		return this.caseInsensitiveExcludes ? value.toLowerCase() : value;
	}

	private getArchivePath( archiveRelativePath: string ): string {
		if ( this.includeBaseDirectory ) {
			return path.posix.join( this.baseDirectory, archiveRelativePath );
		}
		return archiveRelativePath;
	}

	async createZip(): Promise<string> {
		// Remove the destination zip if it exists.
		// see : https://github.com/Ismail-elkorchi/dir-archiver/issues/5
		if ( fs.existsSync( this.zipPath ) ) {
			fs.unlinkSync( this.zipPath );
		}
		fs.accessSync( path.dirname( this.zipPath ), fs.constants.W_OK );
		this.visitedDirectories.clear();
		const filesToArchive = this.collectArchiveEntries( this.directoryPath );

		const ZipWriter = await loadZipWriter();
		let writer: ZipWriterLike | undefined;

		try {
			writer = await ZipWriter.toFile( this.zipPath, {
				// Keep deterministic entry ordering across platforms.
				sinkSeekabilityPolicy: 'on'
			} );

			for ( const entry of filesToArchive ) {
				await writer.add( entry.archivePath, entry.sourcePath );
			}
			await writer.close();
		} catch ( err ) {
			try {
				if ( writer ) {
					await writer.close();
				}
			} catch {
				// Ignore close errors after archive failures.
			}
			try {
				if ( fs.existsSync( this.zipPath ) ) {
					fs.unlinkSync( this.zipPath );
				}
			} catch {
				// Ignore cleanup errors.
			}
			const normalizedError = err instanceof Error ? err : new Error( String( err ) );
			throw normalizedError;
		}

		const zipSize = fs.statSync( this.zipPath ).size;
		console.log( `Created ${this.zipPath} of ${this.prettyBytes( zipSize )}` );
		return this.zipPath;
	}
}

export default DirArchiver;
