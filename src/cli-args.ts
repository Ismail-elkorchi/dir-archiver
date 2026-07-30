import { createParser } from 'argv-flags';
import type { OptionDefinitions, ParseIssue } from 'argv-flags';
import type {
  ArchiveFormat,
  ArchiveWriterFormat,
  SafetyProfile
} from './types.ts';

const CLI_DEFINITIONS = {
  source: {
    type: 'string',
    flags: ['--source']
  },
  input: {
    type: 'string',
    flags: ['--input']
  },
  output: {
    type: 'string',
    flags: ['--output']
  },
  format: {
    type: 'string',
    flags: ['--format']
  },
  safetyProfile: {
    type: 'string',
    flags: ['--safety-profile'],
    default: 'strict'
  },
  json: {
    type: 'boolean',
    flags: ['--json'],
    default: false
  },
  includeBaseDirectory: {
    type: 'boolean',
    flags: ['--include-base-directory'],
    default: false
  },
  followSymlinks: {
    type: 'boolean',
    flags: ['--follow-symlinks'],
    default: false
  },
  exclude: {
    type: 'string',
    flags: ['--exclude'],
    multiple: true
  },
  allowSymlinks: {
    type: 'boolean',
    flags: ['--allow-symlinks'],
    default: false
  },
  maxExtractedFileBytes: {
    type: 'number',
    flags: ['--max-extracted-file-bytes']
  },
  maxTotalExtractedBytes: {
    type: 'number',
    flags: ['--max-total-extracted-bytes']
  }
} as const satisfies OptionDefinitions;

const CLI_PARSER = createParser(CLI_DEFINITIONS);

const SUPPORTED_COMMANDS = [
  'detect',
  'list',
  'audit',
  'extract',
  'normalize',
  'write'
] as const;

type CliCommand = typeof SUPPORTED_COMMANDS[number];

type CliOptionName = keyof typeof CLI_DEFINITIONS;

type CliSemanticIssue = {
  code:
    | 'MISSING_COMMAND'
    | 'UNKNOWN_COMMAND'
    | 'UNEXPECTED_POSITIONAL'
    | 'UNEXPECTED_ARGUMENT_AFTER_DOUBLE_DASH'
    | 'MISSING_OPTION'
    | 'INVALID_OPTION_VALUE'
    | 'OPTION_NOT_ALLOWED';
  message: string;
};

type CliIssue = ParseIssue | CliSemanticIssue;

type ParsedReadOptions = {
  input: string;
  format: ArchiveFormat | undefined;
  safetyProfile: SafetyProfile;
  useJsonOutput: boolean;
};

type ParsedCliArgs =
  | {
    success: false;
    useJsonOutput: boolean;
    issues: CliIssue[];
  }
  | ({
    success: true;
    command: 'detect' | 'list' | 'audit';
  } & ParsedReadOptions)
  | ({
    success: true;
    command: 'extract';
    destination: string;
    allowSymlinks: boolean;
    maxExtractedFileBytes: number | undefined;
    maxTotalExtractedBytes: number | undefined;
  } & ParsedReadOptions)
  | ({
    success: true;
    command: 'normalize';
    destination: string;
  } & ParsedReadOptions)
  | {
    success: true;
    command: 'write';
    source: string;
    destination: string;
    format: ArchiveWriterFormat | undefined;
    useJsonOutput: boolean;
    includeBaseDirectory: boolean;
    followSymlinks: boolean;
    exclude: string[];
  };

const ALLOWED_OPTIONS = {
  detect: ['input', 'format', 'safetyProfile', 'json'],
  list: ['input', 'format', 'safetyProfile', 'json'],
  audit: ['input', 'format', 'safetyProfile', 'json'],
  extract: [
    'input',
    'output',
    'format',
    'safetyProfile',
    'json',
    'allowSymlinks',
    'maxExtractedFileBytes',
    'maxTotalExtractedBytes'
  ],
  normalize: ['input', 'output', 'format', 'safetyProfile', 'json'],
  write: [
    'source',
    'output',
    'format',
    'json',
    'includeBaseDirectory',
    'followSymlinks',
    'exclude'
  ]
} as const satisfies Record<CliCommand, readonly CliOptionName[]>;

export const parseCliArgs = (args: readonly string[]): ParsedCliArgs => {
  const parsed = CLI_PARSER.parse({ args });
  if (!parsed.success) {
    return {
      success: false,
      useJsonOutput: parsed.specified.json,
      issues: parsed.issues
    };
  }

  const { values } = parsed;
  const issues: CliIssue[] = [];
  const command = resolveCommand(parsed.positionals, issues);

  if (parsed.argumentsAfterDoubleDash.length > 0) {
    issues.push({
      code: 'UNEXPECTED_ARGUMENT_AFTER_DOUBLE_DASH',
      message: 'Arguments after "--" are not accepted.'
    });
  }

  if (command === undefined) {
    return failure(values.json, issues);
  }

  validateSpecifiedOptions(command, parsed.specified, issues);

  if (command === 'write') {
    const format = resolveWriteFormat(values.format, issues);
    if (values.source === undefined) {
      issues.push({ code: 'MISSING_OPTION', message: 'write requires --source.' });
    }
    if (values.output === undefined) {
      issues.push({ code: 'MISSING_OPTION', message: 'write requires --output.' });
    }
    if (issues.length > 0 || values.source === undefined || values.output === undefined) {
      return failure(values.json, issues);
    }
    return {
      success: true,
      command,
      source: values.source,
      destination: values.output,
      format,
      useJsonOutput: values.json,
      includeBaseDirectory: values.includeBaseDirectory,
      followSymlinks: values.followSymlinks,
      exclude: values.exclude
    };
  }

  const format = resolveReadFormat(values.format, issues);
  const safetyProfile = resolveSafetyProfile(values.safetyProfile, issues);
  if (values.input === undefined) {
    issues.push({ code: 'MISSING_OPTION', message: `${command} requires --input.` });
  }

  if (command === 'extract' || command === 'normalize') {
    if (values.output === undefined) {
      issues.push({ code: 'MISSING_OPTION', message: `${command} requires --output.` });
    }
  }

  if (command === 'extract') {
    validateByteLimit(
      '--max-extracted-file-bytes',
      values.maxExtractedFileBytes,
      issues
    );
    validateByteLimit(
      '--max-total-extracted-bytes',
      values.maxTotalExtractedBytes,
      issues
    );
  }

  if (
    issues.length > 0
    || values.input === undefined
    || safetyProfile === undefined
  ) {
    return failure(values.json, issues);
  }

  if (command === 'extract') {
    if (values.output === undefined) return failure(values.json, issues);
    return {
      success: true,
      command,
      input: values.input,
      destination: values.output,
      format,
      safetyProfile,
      useJsonOutput: values.json,
      allowSymlinks: values.allowSymlinks,
      maxExtractedFileBytes: values.maxExtractedFileBytes,
      maxTotalExtractedBytes: values.maxTotalExtractedBytes
    };
  }

  if (command === 'normalize') {
    if (values.output === undefined) return failure(values.json, issues);
    return {
      success: true,
      command,
      input: values.input,
      destination: values.output,
      format,
      safetyProfile,
      useJsonOutput: values.json
    };
  }

  return {
    success: true,
    command,
    input: values.input,
    format,
    safetyProfile,
    useJsonOutput: values.json
  };
};

const resolveCommand = (
  positionals: readonly string[],
  issues: CliIssue[]
): CliCommand | undefined => {
  const command = positionals[0];
  if (command === undefined) {
    issues.push({ code: 'MISSING_COMMAND', message: 'Missing command.' });
    return undefined;
  }
  if (!isCliCommand(command)) {
    issues.push({
      code: 'UNKNOWN_COMMAND',
      message: `Unknown command "${command}".`
    });
    return undefined;
  }
  if (positionals.length > 1) {
    issues.push({
      code: 'UNEXPECTED_POSITIONAL',
      message: `Unexpected positional arguments: ${positionals.slice(1).join(', ')}.`
    });
  }
  return command;
};

const validateSpecifiedOptions = (
  command: CliCommand,
  specified: Readonly<Record<string, boolean>>,
  issues: CliIssue[]
): void => {
  const allowed = ALLOWED_OPTIONS[command];
  for (const [optionName, definition] of Object.entries(CLI_DEFINITIONS)) {
    if (
      !specified[optionName]
      || allowed.some((allowedName) => allowedName === optionName)
    ) {
      continue;
    }
    const flag = definition.flags[0];
    issues.push({
      code: 'OPTION_NOT_ALLOWED',
      message: `${flag} is not accepted by ${command}.`
    });
  }
};

const resolveReadFormat = (
  value: string | undefined,
  issues: CliIssue[]
): ArchiveFormat | undefined => {
  if (value === undefined) return undefined;
  if (isArchiveFormat(value)) return value;
  issues.push({
    code: 'INVALID_OPTION_VALUE',
    message: `Unsupported archive format "${value}".`
  });
  return undefined;
};

const resolveWriteFormat = (
  value: string | undefined,
  issues: CliIssue[]
): ArchiveWriterFormat | undefined => {
  if (value === undefined) return undefined;
  if (isArchiveWriterFormat(value)) return value;
  issues.push({
    code: 'INVALID_OPTION_VALUE',
    message: `Unsupported write format "${value}".`
  });
  return undefined;
};

const resolveSafetyProfile = (
  value: string,
  issues: CliIssue[]
): SafetyProfile | undefined => {
  if (isSafetyProfile(value)) return value;
  issues.push({
    code: 'INVALID_OPTION_VALUE',
    message: `Unsupported safety profile "${value}".`
  });
  return undefined;
};

const validateByteLimit = (
  flag: string,
  value: number | undefined,
  issues: CliIssue[]
): void => {
  if (value === undefined || (Number.isSafeInteger(value) && value >= 0)) return;
  issues.push({
    code: 'INVALID_OPTION_VALUE',
    message: `${flag} must be a non-negative safe integer.`
  });
};

const isCliCommand = (value: string): value is CliCommand =>
  SUPPORTED_COMMANDS.some((command) => command === value);

const isArchiveFormat = (value: string): value is ArchiveFormat => {
  switch (value) {
    case 'zip':
    case 'tar':
    case 'gz':
    case 'tgz':
    case 'tar.gz':
    case 'bz2':
    case 'tar.bz2':
    case 'zst':
    case 'br':
    case 'tar.zst':
    case 'tar.br':
    case 'xz':
    case 'tar.xz':
      return true;
    default:
      return false;
  }
};

const isArchiveWriterFormat = (
  value: string
): value is ArchiveWriterFormat => {
  switch (value) {
    case 'zip':
    case 'tar':
    case 'tgz':
    case 'tar.gz':
    case 'tar.zst':
    case 'tar.br':
      return true;
    default:
      return false;
  }
};

const isSafetyProfile = (value: string): value is SafetyProfile => {
  switch (value) {
    case 'compatible':
    case 'strict':
    case 'untrusted':
      return true;
    default:
      return false;
  }
};

const failure = (
  useJsonOutput: boolean,
  issues: CliIssue[]
): ParsedCliArgs => ({
  success: false,
  useJsonOutput,
  issues
});
