import type { Schema } from 'argv-flags';

const CLI_SCHEMA = {
	src: {
		type: 'string',
		flags: [ '--src' ],
		required: true
	},
	dest: {
		type: 'string',
		flags: [ '--dest' ],
		required: true
	},
	includebasedir: {
		type: 'boolean',
		flags: [ '--includebasedir' ],
		default: false
	},
	followsymlinks: {
		type: 'boolean',
		flags: [ '--followsymlinks' ],
		default: false
	},
	exclude: {
		type: 'array',
		flags: [ '--exclude' ],
		default: [] as string[]
	}
} as const satisfies Schema;

export interface ParsedCliArgs {
	directoryPath: string | undefined;
	zipPath: string | undefined;
	includeBaseDirectory: boolean;
	followSymlinks: boolean;
	excludes: string[];
	hasRequiredPaths: boolean;
}

let parseArgsPromise: Promise<ParseArgsFn> | undefined;

type ParseArgsFn = (
	schema: Schema,
	options?: {
		argv?: readonly string[];
		allowUnknown?: boolean;
		stopAtDoubleDash?: boolean;
	}
) => {
	values: Record<string, unknown>;
};

const loadParseArgs = (): Promise<ParseArgsFn> => {
	parseArgsPromise ??= import( 'argv-flags' ).then( ( argvFlagsModule ) => argvFlagsModule.default as ParseArgsFn );
	return parseArgsPromise;
};

const toString = ( value: unknown ): string | undefined => {
	return typeof value === 'string' ? value : undefined;
};

const toBoolean = ( value: unknown ): boolean => {
	return value === true;
};

const toStringArray = ( value: unknown ): string[] => {
	if ( ! Array.isArray( value ) ) {
		return [];
	}
	return value.filter( ( entry ): entry is string => typeof entry === 'string' );
};

export const parseCliArgs = async ( argv: readonly string[] ): Promise<ParsedCliArgs> => {
	const parseArgs = await loadParseArgs();
	const parsed = parseArgs( CLI_SCHEMA, {
		argv: [ ...argv ],
		allowUnknown: true
	} );

	const directoryPath = toString( parsed.values[ 'src' ] );
	const zipPath = toString( parsed.values[ 'dest' ] );
	const includeBaseDirectory = toBoolean( parsed.values[ 'includebasedir' ] );
	const followSymlinks = toBoolean( parsed.values[ 'followsymlinks' ] );
	const excludes = toStringArray( parsed.values[ 'exclude' ] );

	return {
		directoryPath,
		zipPath,
		includeBaseDirectory,
		followSymlinks,
		excludes,
		hasRequiredPaths: typeof directoryPath === 'string' && typeof zipPath === 'string'
	};
};
