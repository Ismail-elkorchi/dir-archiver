declare function parseArgs(
	flag: string,
	type?: 'string' | 'boolean' | 'array'
): string | boolean | string[] | false;

export = parseArgs;
