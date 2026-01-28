declare function parseArgs(
	flag: string,
	type?: 'string' | 'boolean' | 'array'
): string | boolean | string[];

export = parseArgs;
