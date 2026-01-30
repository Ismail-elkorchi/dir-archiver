import { open, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { ZipWriter } from 'zip-next';
import type { ArchiveOptions, ArchiveReport, TimestampMode } from './types.js';
import { planArchive } from './plan.js';
import { mergeSignals, throwIfAborted } from './signals.js';

const ZERO_TIMESTAMP = new Date( '1980-01-01T00:00:00.000Z' );

const resolveTimestamp = (mode: TimestampMode | undefined, mtimeMs: number) => {
	if ( mode === undefined || mode === 'preserve' ) {
		return new Date( mtimeMs );
	}
	if ( mode === 'zero' ) {
		return ZERO_TIMESTAMP;
	}
	return mode;
};

const safeUnlink = async (target: string) => {
	try {
		await unlink( target );
	} catch (err) {
		if ( ( err as NodeJS.ErrnoException ).code !== 'ENOENT' ) {
			throw err;
		}
	}
};

const ensureWritableDestination = async (target: string) => {
	const handle = await open( target, 'w' );
	await handle.close();
};

export const createArchive = async (options: ArchiveOptions): Promise<ArchiveReport> => {
	const startedAt = typeof performance === 'undefined' ? Date.now() : performance.now();
	const destZip = path.resolve( options.destZip );

	const plan = await planArchive( {
		...options,
		destZip
	} );

	await safeUnlink( destZip );
	await ensureWritableDestination( destZip );

	let archiveBytes = 0n;
	const combinedSignal = mergeSignals( options.signal );
	const hasSignal = combinedSignal !== undefined;
	const onProgress = options.onProgress;

	try {
		const writer = await ZipWriter.toFile( destZip, {
			...( options.zip ?? {} ),
			...( hasSignal ? { signal: combinedSignal } : {} )
		} );

		let bytesWritten = 0n;
		let entriesWritten = 0;

		for ( const entry of plan.entries ) {
			throwIfAborted( combinedSignal );
			await writer.add( entry.zipPath, entry.sourcePath, {
				...( options.entry ?? {} ),
				...( hasSignal ? { signal: combinedSignal } : {} ),
				mtime: resolveTimestamp( options.timestamps, entry.mtimeMs )
			} );
			entriesWritten += 1;
			bytesWritten += entry.size;
			if ( typeof onProgress === 'function' ) {
				onProgress( {
					phase: 'write',
					entry,
					entriesProcessed: entriesWritten,
					totalEntries: plan.entryCount,
					bytesProcessed: bytesWritten,
					totalBytes: plan.totalBytes
				} );
			}
		}

		await writer.close( options.comment );
		const stats = await stat( destZip );
		archiveBytes = BigInt( stats.size );
	} catch (err) {
		await safeUnlink( destZip );
		throw err;
	}

	const endedAt = typeof performance === 'undefined' ? Date.now() : performance.now();
	const durationMs = Math.round( endedAt - startedAt );
	const reportMode = options.report ?? 'summary';

	return {
		sourceDir: plan.sourceDir,
		zipPath: destZip,
		baseDirectory: plan.baseDirectory,
		includeBaseDirectory: plan.includeBaseDirectory,
		followSymlinks: plan.followSymlinks,
		excludes: plan.excludes,
		entryCount: plan.entryCount,
		totalBytes: plan.totalBytes,
		archiveBytes,
		durationMs,
		...( reportMode === 'manifest' ? { entries: plan.entries } : {} )
	};
};
