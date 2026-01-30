import type { ArchiveOptions } from './types.js';
import { createArchive } from './archive.js';
import { planArchive } from './plan.js';

export type {
	ArchiveOptions,
	ArchivePlan,
	ArchivePlanEntry,
	ArchivePlanOptions,
	ArchiveProgressEvent,
	ArchiveReport,
	ArchiveReportMode,
	ArchivePhase,
	TimestampMode
} from './types.js';

export { createArchive, planArchive };

export class DirArchiver {
	private readonly sourceDir: string;
	private readonly destZip: string;
	private readonly includeBaseDirectory: boolean;
	private readonly excludes: string[];
	private readonly followSymlinks: boolean;

	constructor(
		sourceDir: string,
		destZip: string,
		includeBaseDirectory = false,
		excludes: string[] = [],
		followSymlinks = false
	) {
		this.sourceDir = sourceDir;
		this.destZip = destZip;
		this.includeBaseDirectory = includeBaseDirectory;
		this.excludes = excludes;
		this.followSymlinks = followSymlinks;
	}

	async createZip(): Promise<string> {
		const options: ArchiveOptions = {
			sourceDir: this.sourceDir,
			destZip: this.destZip,
			includeBaseDirectory: this.includeBaseDirectory,
			excludes: this.excludes,
			followSymlinks: this.followSymlinks
		};
		const report = await createArchive( options );
		return report.zipPath;
	}
}

export default DirArchiver;
