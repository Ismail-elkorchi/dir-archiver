export interface ZipWriterLike {
	add: (
		name: string,
		source: string
	) => Promise<void>;
	close: () => Promise<void>;
}

export interface ZipWriterOptions {
	sinkSeekabilityPolicy?: 'auto' | 'on' | 'off';
}

export type CreateZipWriter = (
	path: string | URL,
	options?: ZipWriterOptions
) => Promise<ZipWriterLike>;
