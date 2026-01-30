import { constants, type Stats } from 'node:fs';
import { access, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { ArchivePlan, ArchivePlanEntry, ArchivePlanOptions } from './types.js';
import { throwIfAborted } from './signals.js';

const normalizePathValue = (value: string, caseInsensitive: boolean) =>
	caseInsensitive ? value.toLowerCase() : value;

const buildExcludeMatcher = (sourceDir: string, destZip: string | undefined, excludes: string[]) => {
	const caseInsensitive = process.platform === 'win32';
	const excludedPaths = new Set<string>();
	const excludedNames = new Set<string>();

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
			const relativeCandidate = path.relative( sourceDir, normalizedExclude );
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
		const normalizedValue = normalizePathValue( trimmedExclude, caseInsensitive );
		excludedPaths.add( normalizedValue );
		if ( ! hasSeparator ) {
			excludedNames.add( normalizedValue );
		}
	}

	if ( destZip !== undefined ) {
		const relativeZipPath = path.relative( sourceDir, destZip );
		const isZipInsideSource = relativeZipPath.length > 0
			&& ! relativeZipPath.startsWith( '..' )
			&& ! path.isAbsolute( relativeZipPath );
		if ( isZipInsideSource ) {
			const normalizedZipPath = path.normalize( relativeZipPath );
			excludedPaths.add( normalizePathValue( normalizedZipPath, caseInsensitive ) );
		}
	}

	const isExcluded = (relativePath: string) => {
		const normalizedRelative = path.normalize( relativePath );
		const normalizedValue = normalizePathValue( normalizedRelative, caseInsensitive );
		const baseName = path.basename( normalizedRelative );
		const normalizedName = normalizePathValue( baseName, caseInsensitive );
		return excludedPaths.has( normalizedValue ) || excludedNames.has( normalizedName );
	};

	return { isExcluded };
};

const comparePaths = (first: string, second: string) => {
	if ( first < second ) {
		return -1;
	}
	if ( first > second ) {
		return 1;
	}
	return 0;
};

export const planArchive = async (options: ArchivePlanOptions): Promise<ArchivePlan> => {
	const sourceDir = path.resolve( options.sourceDir );
	const destZip = options.destZip !== undefined ? path.resolve( options.destZip ) : undefined;
	const includeBaseDirectory = options.includeBaseDirectory ?? false;
	const excludes = Array.isArray( options.excludes ) ? options.excludes : [];
	const followSymlinks = options.followSymlinks ?? false;
	const baseDirectory = path.basename( sourceDir );
	const matcher = buildExcludeMatcher( sourceDir, destZip, excludes );
	const onProgress = options.onProgress;

	const entries: ArchivePlanEntry[] = [];
	let totalBytes = 0n;
	let entriesProcessed = 0;

	const directoriesToVisit: string[] = [ sourceDir ];
	const visitedDirectories = new Set<string>();

	while ( directoriesToVisit.length > 0 ) {
		throwIfAborted( options.signal );
		const currentDirectory = directoriesToVisit.pop();
		if ( currentDirectory === undefined ) {
			continue;
		}

		if ( followSymlinks ) {
			try {
				const realPath = await realpath( currentDirectory );
				if ( visitedDirectories.has( realPath ) ) {
					continue;
				}
				visitedDirectories.add( realPath );
			} catch {
				continue;
			}
		}

		const dirEntries = await readdir( currentDirectory, { withFileTypes: true } );
		dirEntries.sort( ( first, second ) => comparePaths( first.name, second.name ) );

		const pendingDirectories: string[] = [];

		for ( const entry of dirEntries ) {
			const fullPath = path.join( currentDirectory, entry.name );
			if ( destZip !== undefined && fullPath === destZip ) {
				continue;
			}
			const relativePath = path.relative( sourceDir, fullPath );
			if ( relativePath.length === 0 ) {
				continue;
			}
			const normalizedRelative = path.normalize( relativePath );
			if ( matcher.isExcluded( normalizedRelative ) ) {
				continue;
			}

			if ( entry.isDirectory() ) {
				pendingDirectories.push( fullPath );
				continue;
			}

			if ( entry.isFile() ) {
				const stats = await stat( fullPath );
				await access( fullPath, constants.R_OK );
				const archiveRelative = normalizedRelative.replace( /\\/g, '/' );
				const zipPath = includeBaseDirectory
					? path.posix.join( baseDirectory, archiveRelative )
					: archiveRelative;
				const planEntry: ArchivePlanEntry = {
					sourcePath: fullPath,
					relativePath: normalizedRelative,
					zipPath,
					size: BigInt( stats.size ),
					mtimeMs: stats.mtimeMs,
					isSymlink: false
				};
				entries.push( planEntry );
				totalBytes += BigInt( stats.size );
				entriesProcessed += 1;
				if ( typeof onProgress === 'function' ) {
					onProgress( {
						phase: 'scan',
						entry: planEntry,
						entriesProcessed,
						bytesProcessed: totalBytes
					} );
				}
				continue;
			}

			if ( entry.isSymbolicLink() ) {
				if ( ! followSymlinks ) {
					continue;
				}
				let stats: Stats;
				try {
					stats = await stat( fullPath );
				} catch {
					continue;
				}
				if ( stats.isDirectory() ) {
					pendingDirectories.push( fullPath );
					continue;
				}
				if ( stats.isFile() ) {
					await access( fullPath, constants.R_OK );
					const archiveRelative = normalizedRelative.replace( /\\/g, '/' );
					const zipPath = includeBaseDirectory
						? path.posix.join( baseDirectory, archiveRelative )
						: archiveRelative;
					const planEntry: ArchivePlanEntry = {
						sourcePath: fullPath,
						relativePath: normalizedRelative,
						zipPath,
						size: BigInt( stats.size ),
						mtimeMs: stats.mtimeMs,
						isSymlink: true
					};
					entries.push( planEntry );
					totalBytes += BigInt( stats.size );
					entriesProcessed += 1;
					if ( typeof onProgress === 'function' ) {
						onProgress( {
							phase: 'scan',
							entry: planEntry,
							entriesProcessed,
							bytesProcessed: totalBytes
						} );
					}
				}
			}
		}

		for ( let index = pendingDirectories.length - 1; index >= 0; index -= 1 ) {
			const nextDirectory = pendingDirectories[ index ];
			if ( nextDirectory !== undefined ) {
				directoriesToVisit.push( nextDirectory );
			}
		}
	}

	entries.sort( ( first, second ) => comparePaths( first.zipPath, second.zipPath ) );

	return {
		sourceDir,
		...( destZip !== undefined ? { destZip } : {} ),
		baseDirectory,
		includeBaseDirectory,
		followSymlinks,
		excludes,
		entries,
		entryCount: entries.length,
		totalBytes
	};
};
