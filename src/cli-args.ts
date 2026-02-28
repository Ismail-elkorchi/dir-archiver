import type { Schema } from 'argv-flags';
import type { ArchiveFormat, ArchiveProfile } from './types.js';

const SUPPORTED_COMMANDS = new Set(['open', 'detect', 'list', 'audit', 'extract', 'normalize', 'write']);

const SUPPORTED_FORMATS = new Set<ArchiveFormat>([
  'zip',
  'tar',
  'tgz',
  'tar.gz',
  'gz',
  'bz2',
  'tar.bz2',
  'zst',
  'tar.zst',
  'br',
  'tar.br',
  'xz',
  'tar.xz'
]);

const SUPPORTED_PROFILES = new Set<ArchiveProfile>(['compat', 'strict', 'agent']);

const CLI_SCHEMA = {
  source: {
    type: 'string',
    flags: ['--source', '--src']
  },
  input: {
    type: 'string',
    flags: ['--input', '-i']
  },
  output: {
    type: 'string',
    flags: ['--output', '--dest', '-o']
  },
  format: {
    type: 'string',
    flags: ['--format']
  },
  profile: {
    type: 'string',
    flags: ['--profile'],
    default: 'strict'
  },
  json: {
    type: 'boolean',
    flags: ['--json'],
    default: false
  },
  includeBaseDirectory: {
    type: 'boolean',
    flags: ['--include-base-directory', '--includebasedir'],
    default: false
  },
  followSymlinks: {
    type: 'boolean',
    flags: ['--follow-symlinks', '--followsymlinks'],
    default: false
  },
  exclude: {
    type: 'array',
    flags: ['--exclude'],
    default: [] as string[]
  },
  allowSymlinks: {
    type: 'boolean',
    flags: ['--allow-symlinks'],
    default: false
  },
  allowHardlinks: {
    type: 'boolean',
    flags: ['--allow-hardlinks'],
    default: false
  },
  maxEntryBytes: {
    type: 'number',
    flags: ['--max-entry-bytes']
  },
  maxTotalExtractedBytes: {
    type: 'number',
    flags: ['--max-total-extracted-bytes']
  }
} as const satisfies Schema;

export type CliCommand = 'open' | 'detect' | 'list' | 'audit' | 'extract' | 'normalize' | 'write';

export interface ParsedCliArgs {
  ok: boolean;
  issues: { code: string; message: string }[];
  command: CliCommand | undefined;
  input: string | undefined;
  source: string | undefined;
  output: string | undefined;
  format: ArchiveFormat | undefined;
  profile: ArchiveProfile;
  json: boolean;
  includeBaseDirectory: boolean;
  followSymlinks: boolean;
  exclude: string[];
  allowSymlinks: boolean;
  allowHardlinks: boolean;
  maxEntryBytes: number | undefined;
  maxTotalExtractedBytes: number | undefined;
}

type ParseArgsFn = (
  schema: Schema,
  options?: {
    argv?: readonly string[];
    allowUnknown?: boolean;
    stopAtDoubleDash?: boolean;
  }
) => {
  values: Record<string, unknown>;
  rest: string[];
  issues: {
    code: string;
    message: string;
  }[];
  ok: boolean;
};

let parseArgsPromise: Promise<ParseArgsFn> | undefined;

const loadParseArgs = (): Promise<ParseArgsFn> => {
  parseArgsPromise ??= import('argv-flags').then((moduleExports) => moduleExports.default as ParseArgsFn);
  return parseArgsPromise;
};

export const parseCliArgs = async (argv: readonly string[]): Promise<ParsedCliArgs> => {
  const parseArgs = await loadParseArgs();
  const parsed = parseArgs(CLI_SCHEMA, {
    argv: [...argv]
  });

  const issues = parsed.issues.map((issue) => ({
    code: issue.code,
    message: issue.message
  }));

  const values = parsed.values;
  const commandToken = parsed.rest[0];
  const command = resolveCommand(commandToken, values, issues);
  const profile = resolveProfile(values['profile'], issues);
  const format = resolveFormat(values['format'], issues);

  const source = toOptionalString(values['source']);
  const input = toOptionalString(values['input']);
  const output = toOptionalString(values['output']);

  validateCommandRequirements(command, { source, input, output }, issues);

  return {
    ok: issues.length === 0,
    issues,
    command,
    source,
    input,
    output,
    format,
    profile,
    json: values['json'] === true,
    includeBaseDirectory: values['includeBaseDirectory'] === true,
    followSymlinks: values['followSymlinks'] === true,
    exclude: toStringArray(values['exclude']),
    allowSymlinks: values['allowSymlinks'] === true,
    allowHardlinks: values['allowHardlinks'] === true,
    maxEntryBytes: toOptionalNumber(values['maxEntryBytes']),
    maxTotalExtractedBytes: toOptionalNumber(values['maxTotalExtractedBytes'])
  };
};

const resolveCommand = (
  commandToken: string | undefined,
  values: Record<string, unknown>,
  issues: { code: string; message: string }[]
): CliCommand | undefined => {
  if (typeof commandToken === 'string' && SUPPORTED_COMMANDS.has(commandToken)) {
    return commandToken as CliCommand;
  }

  if (typeof commandToken === 'string' && commandToken.length > 0) {
    issues.push({
      code: 'USAGE',
      message: `Unknown command "${commandToken}".`
    });
    return undefined;
  }

  const hasSource = typeof values['source'] === 'string';
  const hasOutput = typeof values['output'] === 'string';
  if (hasSource && hasOutput) {
    return 'write';
  }

  issues.push({
    code: 'USAGE',
    message: 'Missing command.'
  });
  return undefined;
};

const resolveProfile = (
  value: unknown,
  issues: { code: string; message: string }[]
): ArchiveProfile => {
  const normalized = typeof value === 'string' ? value : 'strict';
  if (!SUPPORTED_PROFILES.has(normalized as ArchiveProfile)) {
    issues.push({
      code: 'INVALID_VALUE',
      message: `Unsupported profile "${String(value)}".`
    });
    return 'strict';
  }
  return normalized as ArchiveProfile;
};

const resolveFormat = (
  value: unknown,
  issues: { code: string; message: string }[]
): ArchiveFormat | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  if (!SUPPORTED_FORMATS.has(value as ArchiveFormat)) {
    issues.push({
      code: 'INVALID_VALUE',
      message: `Unsupported format "${value}".`
    });
    return undefined;
  }
  return value as ArchiveFormat;
};

const validateCommandRequirements = (
  command: CliCommand | undefined,
  values: {
    source: string | undefined;
    input: string | undefined;
    output: string | undefined;
  },
  issues: { code: string; message: string }[]
): void => {
  if (!command) {
    return;
  }

  if (command === 'write') {
    if (!values.source) {
      issues.push({ code: 'REQUIRED', message: 'write requires --source/--src.' });
    }
    if (!values.output) {
      issues.push({ code: 'REQUIRED', message: 'write requires --output/--dest.' });
    }
    return;
  }

  if (command === 'extract' || command === 'normalize') {
    if (!values.input) {
      issues.push({ code: 'REQUIRED', message: `${command} requires --input.` });
    }
    if (!values.output) {
      issues.push({ code: 'REQUIRED', message: `${command} requires --output.` });
    }
    return;
  }

  if (!values.input) {
    issues.push({ code: 'REQUIRED', message: `${command} requires --input.` });
  }
};

const toOptionalString = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
};

const toOptionalNumber = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};
