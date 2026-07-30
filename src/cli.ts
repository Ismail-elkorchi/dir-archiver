#!/usr/bin/env node

import { audit, detect, extract, list, normalize, write } from './index.ts';
import { DirArchiverError } from './errors.ts';
import { parseCliArgs } from './cli-args.ts';

const usage = `Usage:
  dir-archiver write --source <path> --output <archive> [--format <format>] [--include-base-directory] [--exclude <path>]...
  dir-archiver detect --input <archive>
  dir-archiver list --input <archive>
  dir-archiver audit --input <archive> [--safety-profile compatible|strict|untrusted]
  dir-archiver extract --input <archive> --output <directory> [--safety-profile compatible|strict|untrusted] [--max-extracted-file-bytes <n>] [--max-total-extracted-bytes <n>]
  dir-archiver normalize --input <archive> --output <archive> [--safety-profile compatible|strict|untrusted]

Options:
  --format <format>                     Read: zip|tar|gz|tgz|tar.gz|bz2|tar.bz2|zst|br|tar.zst|tar.br|xz|tar.xz
                                        Write: zip|tar|tgz|tar.gz|tar.zst|tar.br
  --safety-profile <profile>            compatible|strict|untrusted
  --json                                Emit machine-readable JSON
  --allow-symlinks                      Materialize safe relative symlinks during extraction
`;

const run = async (): Promise<number> => {
  const parsed = parseCliArgs(process.argv.slice(2));
  if (!parsed.success) {
    const payload = {
      schemaVersion: '1',
      code: 'DIRARCHIVER_USAGE',
      message: 'Invalid CLI arguments.',
      issues: parsed.issues
    };
    if (parsed.useJsonOutput) {
      console.log(JSON.stringify(payload));
    } else {
      console.error(usage);
      for (const issue of parsed.issues) {
        console.error(`- [${issue.code}] ${issue.message}`);
      }
    }
    return 2;
  }

  switch (parsed.command) {
    case 'write': {
      const result = await write(parsed.source, parsed.destination, {
        ...(parsed.format === undefined ? {} : { format: parsed.format }),
        includeBaseDirectory: parsed.includeBaseDirectory,
        followSymlinks: parsed.followSymlinks,
        exclude: parsed.exclude
      });
      printResult(parsed.useJsonOutput, result);
      return 0;
    }
    case 'detect': {
      const result = await detect(parsed.input, {
        ...(parsed.format === undefined ? {} : { format: parsed.format }),
        safetyProfile: parsed.safetyProfile
      });
      printResult(parsed.useJsonOutput, result);
      return 0;
    }
    case 'list': {
      const result = await list(parsed.input, {
        ...(parsed.format === undefined ? {} : { format: parsed.format }),
        safetyProfile: parsed.safetyProfile
      });
      printResult(parsed.useJsonOutput, result);
      return 0;
    }
    case 'audit': {
      const result = await audit(parsed.input, {
        ...(parsed.format === undefined ? {} : { format: parsed.format }),
        safetyProfile: parsed.safetyProfile
      });
      printResult(parsed.useJsonOutput, result);
      return 0;
    }
    case 'extract': {
      const result = await extract(parsed.input, parsed.destination, {
        ...(parsed.format === undefined ? {} : { format: parsed.format }),
        safetyProfile: parsed.safetyProfile,
        allowSymlinks: parsed.allowSymlinks,
        ...(parsed.maxExtractedFileBytes === undefined
          ? {}
          : { maxExtractedFileBytes: parsed.maxExtractedFileBytes }),
        ...(parsed.maxTotalExtractedBytes === undefined
          ? {}
          : { maxTotalExtractedBytes: parsed.maxTotalExtractedBytes })
      });
      printResult(parsed.useJsonOutput, result);
      return 0;
    }
    case 'normalize': {
      const result = await normalize(parsed.input, parsed.destination, {
        ...(parsed.format === undefined ? {} : { format: parsed.format }),
        safetyProfile: parsed.safetyProfile
      });
      printResult(parsed.useJsonOutput, result);
      return 0;
    }
  }
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
