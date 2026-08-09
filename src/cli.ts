#!/usr/bin/env node

import {
  createCli,
  createCliHelp,
  formatCliDiagnostics,
  formatCliHelp,
  value
} from 'clivoke';
import packageMetadata from '../package.json' with { type: 'json' };
import { audit, detect, extract, list, normalize, write } from './index.ts';
import { DirArchiverError } from './errors.ts';
import type {
  ArchiveFormat,
  ArchiveWriterFormat,
  SafetyProfile
} from './types.ts';

const READ_FORMATS = [
  'zip',
  'tar',
  'gz',
  'tgz',
  'tar.gz',
  'bz2',
  'tar.bz2',
  'zst',
  'br',
  'tar.zst',
  'tar.br',
  'xz',
  'tar.xz'
] as const satisfies readonly ArchiveFormat[];

const WRITE_FORMATS = [
  'zip',
  'tar',
  'tgz',
  'tar.gz',
  'tar.zst',
  'tar.br'
] as const satisfies readonly ArchiveWriterFormat[];

const SAFETY_PROFILES = [
  'compatible',
  'strict',
  'untrusted'
] as const satisfies readonly SafetyProfile[];

const inputOption = {
  type: 'string',
  flags: ['-i', '--input'],
  required: true,
  description: 'Input archive path or URL.',
  valueLabel: 'archive'
} as const;

const outputOption = {
  type: 'string',
  flags: ['-o', '--output'],
  required: true,
  description: 'Destination path.',
  valueLabel: 'path'
} as const;

const readOptions = {
  input: inputOption,
  format: {
    type: value.choice(READ_FORMATS),
    flags: ['--format'],
    description: 'Force the input archive format.',
    valueLabel: 'format'
  },
  safetyProfile: {
    type: value.choice(SAFETY_PROFILES),
    flags: ['--safety-profile'],
    default: 'strict',
    description: 'Select archive safety policy.',
    valueLabel: 'profile'
  }
} as const;

const DIR_ARCHIVER_CLI = createCli({
  name: 'dir-archiver',
  version: packageMetadata.version,
  description: 'Create, inspect, audit, normalize, and extract archives.',
  invokable: false,
  options: {
    json: {
      type: 'boolean',
      flags: ['--json'],
      default: false,
      description: 'Emit machine-readable success output.'
    }
  },
  commands: [
    {
      name: 'write',
      description: 'Create an archive from a file or directory.',
      options: {
        source: {
          type: 'string',
          flags: ['-s', '--source'],
          required: true,
          description: 'Source file or directory.',
          valueLabel: 'path'
        },
        output: outputOption,
        format: {
          type: value.choice(WRITE_FORMATS),
          flags: ['--format'],
          description: 'Force the output archive format.',
          valueLabel: 'format'
        },
        includeBaseDirectory: {
          type: 'boolean',
          flags: ['--include-base-directory'],
          default: false,
          description: 'Prefix entries with the source directory name.'
        },
        followSymlinks: {
          type: 'boolean',
          flags: ['--follow-symlinks'],
          default: false,
          description: 'Follow symlinks in the source tree.'
        },
        exclude: {
          type: 'string',
          flags: ['--exclude'],
          multiple: true,
          description: 'Exclude one basename or relative path.',
          valueLabel: 'path'
        }
      }
    },
    {
      name: 'detect',
      description: 'Detect an archive format.',
      options: readOptions
    },
    {
      name: 'list',
      description: 'List archive entries.',
      options: readOptions
    },
    {
      name: 'audit',
      description: 'Produce an archive safety report.',
      options: readOptions
    },
    {
      name: 'extract',
      description: 'Audit and extract an archive.',
      options: {
        ...readOptions,
        output: outputOption,
        allowSymlinks: {
          type: 'boolean',
          flags: ['--allow-symlinks'],
          default: false,
          description: 'Materialize safe relative symlink entries.'
        },
        maxExtractedFileBytes: {
          type: value.integer({ minimum: 0 }),
          flags: ['--max-extracted-file-bytes'],
          description: 'Set the extracted byte limit for one file.',
          valueLabel: 'bytes'
        },
        maxTotalExtractedBytes: {
          type: value.integer({ minimum: 0 }),
          flags: ['--max-total-extracted-bytes'],
          description: 'Set the total extracted byte limit.',
          valueLabel: 'bytes'
        }
      }
    },
    {
      name: 'normalize',
      description: 'Write deterministic normalized output.',
      options: {
        ...readOptions,
        output: outputOption
      }
    }
  ]
});

const run = async (): Promise<number> => {
  const invocation = DIR_ARCHIVER_CLI.parse({ argv: process.argv.slice(2) });
  if (invocation.status === 'help') {
    console.log(formatUsage(invocation.commandPath));
    return 0;
  }
  if (invocation.status === 'version') {
    console.log(`dir-archiver ${invocation.version}`);
    return 0;
  }
  if (invocation.status === 'invalid') {
    console.error(formatUsage(invocation.command?.path ?? []));
    console.error(formatCliDiagnostics(invocation.diagnostics));
    return 2;
  }

  switch (invocation.commandKey) {
    case 'dir-archiver write': {
      const { optionValues } = invocation;
      const result = await write(optionValues.source, optionValues.output, {
        ...(optionValues.format === undefined ? {} : { format: optionValues.format }),
        includeBaseDirectory: optionValues.includeBaseDirectory,
        followSymlinks: optionValues.followSymlinks,
        exclude: optionValues.exclude
      });
      printResult(optionValues.json, result);
      return 0;
    }
    case 'dir-archiver detect': {
      const { optionValues } = invocation;
      const result = await detect(optionValues.input, {
        ...(optionValues.format === undefined ? {} : { format: optionValues.format }),
        safetyProfile: optionValues.safetyProfile
      });
      printResult(optionValues.json, result);
      return 0;
    }
    case 'dir-archiver list': {
      const { optionValues } = invocation;
      const result = await list(optionValues.input, {
        ...(optionValues.format === undefined ? {} : { format: optionValues.format }),
        safetyProfile: optionValues.safetyProfile
      });
      printResult(optionValues.json, result);
      return 0;
    }
    case 'dir-archiver audit': {
      const { optionValues } = invocation;
      const result = await audit(optionValues.input, {
        ...(optionValues.format === undefined ? {} : { format: optionValues.format }),
        safetyProfile: optionValues.safetyProfile
      });
      printResult(optionValues.json, result);
      return 0;
    }
    case 'dir-archiver extract': {
      const { optionValues } = invocation;
      const result = await extract(optionValues.input, optionValues.output, {
        ...(optionValues.format === undefined ? {} : { format: optionValues.format }),
        safetyProfile: optionValues.safetyProfile,
        allowSymlinks: optionValues.allowSymlinks,
        ...(optionValues.maxExtractedFileBytes === undefined
          ? {}
          : { maxExtractedFileBytes: optionValues.maxExtractedFileBytes }),
        ...(optionValues.maxTotalExtractedBytes === undefined
          ? {}
          : { maxTotalExtractedBytes: optionValues.maxTotalExtractedBytes })
      });
      printResult(optionValues.json, result);
      return 0;
    }
    case 'dir-archiver normalize': {
      const { optionValues } = invocation;
      const result = await normalize(optionValues.input, optionValues.output, {
        ...(optionValues.format === undefined ? {} : { format: optionValues.format }),
        safetyProfile: optionValues.safetyProfile
      });
      printResult(optionValues.json, result);
      return 0;
    }
  }
};

const formatUsage = (commandPath: readonly string[]): string => {
  const help = createCliHelp(DIR_ARCHIVER_CLI, commandPath);
  if (help === undefined) return 'Usage: dir-archiver <command> [options]';
  return formatCliHelp(help);
};

const printResult = (asJson: boolean, payload: unknown): void => {
  if (asJson) {
    console.log(JSON.stringify(payload));
    return;
  }
  console.log(payload);
};

void run()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    if (error instanceof DirArchiverError) {
      console.error(JSON.stringify(error.toJSON()));
      process.exitCode = 1;
      return;
    }
    if (error instanceof Error) {
      console.error(error.stack ?? error.message);
    } else {
      console.error(String(error));
    }
    process.exitCode = 1;
  });
