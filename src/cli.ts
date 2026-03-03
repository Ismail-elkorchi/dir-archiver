#!/usr/bin/env node

import { audit, detect, extract, list, normalize, open, write } from './index.js';
import { DirArchiverError } from './errors.js';
import { parseCliArgs } from './cli-args.js';

const usage = `Usage:
  dir-archiver write --source <path> --output <archive> [--format <format>] [--include-base-directory] [--exclude <path>...]
  dir-archiver open --input <archive> [--profile compat|strict|agent]
  dir-archiver detect --input <archive>
  dir-archiver list --input <archive>
  dir-archiver audit --input <archive> [--profile compat|strict|agent]
  dir-archiver extract --input <archive> --output <directory> [--profile compat|strict|agent] [--max-entry-bytes <n>] [--max-total-extracted-bytes <n>]
  dir-archiver normalize --input <archive> --output <archive> [--profile compat|strict|agent]

Common options:
  --format <format>                     zip|tar|tgz|tar.gz|gz|bz2|tar.bz2|zst|tar.zst|br|tar.br|xz|tar.xz
  --profile <profile>                   compat|strict|agent
  --json                                emit machine-readable JSON
  --allow-symlinks                      enable symlink extraction
  --allow-hardlinks                     enable hardlink extraction (currently unsupported)
`;

const run = async (): Promise<number> => {
  const parsed = await parseCliArgs(process.argv.slice(2));
  const command = parsed.command;
  if (!parsed.ok || !command) {
    const payload = {
      schemaVersion: '1',
      code: 'DIRARCHIVER_USAGE',
      message: 'Invalid CLI arguments.',
      issues: parsed.issues
    };
    if (parsed.json) {
      console.log(JSON.stringify(payload));
    } else {
      console.error(usage);
      for (const issue of parsed.issues) {
        console.error(`- [${issue.code}] ${issue.message}`);
      }
    }
    return 2;
  }

  const commonOptions = {
    profile: parsed.profile,
    ...(parsed.format ? { format: parsed.format } : {})
  };

  switch (command) {
    case 'write': {
      const result = await write(
        requireString(parsed.source, 'write requires --source/--src'),
        requireString(parsed.output, 'write requires --output/--dest'),
        {
          ...commonOptions,
          includeBaseDirectory: parsed.includeBaseDirectory,
          followSymlinks: parsed.followSymlinks,
          exclude: parsed.exclude
        }
      );
      outputResult(parsed.json, result);
      return 0;
    }
    case 'open': {
      const reader = await open(requireString(parsed.input, 'open requires --input'), commonOptions);
      outputResult(parsed.json, {
        format: reader.format,
        detection: reader.detection
      });
      return 0;
    }
    case 'detect': {
      const result = await detect(requireString(parsed.input, 'detect requires --input'), commonOptions);
      outputResult(parsed.json, result);
      return 0;
    }
    case 'list': {
      const result = await list(requireString(parsed.input, 'list requires --input'), commonOptions);
      outputResult(parsed.json, result);
      return 0;
    }
    case 'audit': {
      const result = await audit(requireString(parsed.input, 'audit requires --input'), commonOptions);
      outputResult(parsed.json, result);
      return 0;
    }
    case 'extract': {
      const result = await extract(
        requireString(parsed.input, 'extract requires --input'),
        requireString(parsed.output, 'extract requires --output'),
        {
          ...commonOptions,
          allowSymlinks: parsed.allowSymlinks,
          allowHardlinks: parsed.allowHardlinks,
          ...(typeof parsed.maxEntryBytes === 'number' ? { maxEntryBytes: parsed.maxEntryBytes } : {}),
          ...(typeof parsed.maxTotalExtractedBytes === 'number'
            ? { maxTotalExtractedBytes: parsed.maxTotalExtractedBytes }
            : {})
        }
      );
      outputResult(parsed.json, result);
      return 0;
    }
    case 'normalize': {
      const result = await normalize(
        requireString(parsed.input, 'normalize requires --input'),
        requireString(parsed.output, 'normalize requires --output'),
        {
          ...commonOptions
        }
      );
      outputResult(parsed.json, result);
      return 0;
    }
    default:
      break;
  }

  const unreachable: never = command;
  throw new Error(`Unhandled command: ${String(unreachable)}`);
};

const outputResult = (asJson: boolean, payload: unknown): void => {
  if (asJson) {
    console.log(JSON.stringify(payload));
    return;
  }
  console.log(payload);
};

const requireString = (value: string | undefined, message: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new DirArchiverError('DIRARCHIVER_USAGE', message);
  }
  return value;
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
