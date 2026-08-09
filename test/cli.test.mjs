import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const CLI_PATH = path.join(process.cwd(), 'dist', 'cli.js');

const runCli = (args) => {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: 'utf8'
  });
};

const cleanup = (target) => {
  rmSync(target, { recursive: true, force: true });
};

const assertUsageFailure = (result, codes) => {
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^Usage: dir-archiver/u);
  for (const code of codes) {
    assert.match(result.stderr, new RegExp(`^${code}:`, 'mu'));
  }
};

test('invalid invocations use terminal diagnostics even when --json is present', () => {
  const result = runCli(['detect', '--input', 'archive.zip', '--unknown', '1', '--json']);
  assertUsageFailure(result, ['CLI_UNKNOWN_FLAG', 'CLI_UNEXPECTED_POSITIONAL']);
  assert.match(result.stderr, /^Usage: dir-archiver detect \[options\]$/mu);
  assert.match(result.stderr, /^(?: {2})-i, --input <archive>(?: {2})Input archive path or URL\.$/mu);
  assert.match(result.stderr, /Unknown flag: --unknown\. \[argv=3\]/u);
});

test('help and version are successful grammar-aware actions', () => {
  for (const args of [['-h'], ['--help'], ['detect', '--help']]) {
    const result = runCli(args);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /^Usage: dir-archiver/u);
    assert.match(result.stdout, /-h, --help {2}Show help\./u);
  }

  const version = runCli(['--version']);
  assert.equal(version.status, 0);
  assert.equal(version.stderr, '');
  assert.equal(version.stdout, 'dir-archiver 4.0.0\n');

  const afterTerminator = runCli(['detect', '--input', 'archive.zip', '--', '--help']);
  assertUsageFailure(afterTerminator, ['CLI_PASSTHROUGH_ARGUMENTS_NOT_ACCEPTED']);
});

test('write and extract commands succeed in JSON mode', () => {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-cli-test-'));
  try {
    const source = path.join(tmpRoot, 'src');
    mkdirSync(source, { recursive: true });
    writeFileSync(path.join(source, 'hello.txt'), 'hello');

    const archive = path.join(tmpRoot, 'archive.zip');
    const writeResult = runCli(['--json', 'write', '-s', source, '-o', archive]);
    assert.equal(writeResult.status, 0);

    const extracted = path.join(tmpRoot, 'out');
    const extractResult = runCli([
      'extract',
      '-i',
      archive,
      '-o',
      extracted,
      '--safety-profile',
      'strict',
      '--max-extracted-file-bytes',
      '5',
      '--json'
    ]);
    assert.equal(extractResult.status, 0);
    assert.equal(JSON.parse(extractResult.stdout).extractedFileCount, 1);

    const extractedFile = path.join(extracted, 'hello.txt');
    assert.equal(readFileSync(extractedFile, 'utf8'), 'hello');
  } finally {
    cleanup(tmpRoot);
  }
});

test('duplicate scalar options fail instead of silently selecting a value', () => {
  const result = runCli([
    'detect',
    '--input',
    'first.zip',
    '-i',
    'second.zip',
    '--json'
  ]);
  assertUsageFailure(result, ['REPEATED_OPTION']);
});

test('legacy aliases and implicit write invocation are not accepted', () => {
  const aliasResult = runCli([
    'write',
    '--src',
    'source',
    '--dest',
    'archive.zip',
    '--json'
  ]);
  assertUsageFailure(aliasResult, ['MISSING_REQUIRED_OPTION', 'CLI_UNKNOWN_FLAG']);
  assert.equal(aliasResult.stderr.match(/^CLI_UNKNOWN_FLAG:/gmu)?.length, 2);

  const implicitResult = runCli([
    '--source',
    'source',
    '--output',
    'archive.zip',
    '--json'
  ]);
  assertUsageFailure(implicitResult, ['CLI_UNKNOWN_FLAG']);
});

test('invalid safety profiles and post-double-dash arguments fail without fallback values', () => {
  const profileResult = runCli([
    'audit',
    '--input',
    'archive.zip',
    '--safety-profile',
    'agent',
    '--json'
  ]);
  assertUsageFailure(profileResult, ['INVALID_OPTION_VALUE']);

  const boundaryResult = runCli([
    'detect',
    '--input',
    'archive.zip',
    '--json',
    '--',
    'extra'
  ]);
  assertUsageFailure(boundaryResult, ['CLI_PASSTHROUGH_ARGUMENTS_NOT_ACCEPTED']);
});

test('options that do not belong to a command are rejected', () => {
  const result = runCli([
    'detect',
    '--input',
    'archive.zip',
    '--allow-symlinks',
    '--json'
  ]);
  assertUsageFailure(result, ['CLI_UNKNOWN_FLAG']);
});

test('command-local options must follow their command', () => {
  const result = runCli(['--input', 'archive.zip', 'detect', '--json']);
  assertUsageFailure(result, ['CLI_UNKNOWN_FLAG']);
  assert.match(result.stderr, /Unknown flag: --input\. \[argv=0\]/u);
});

test('command definitions enforce command-specific values and numeric bounds', () => {
  const writeFormat = runCli([
    'write',
    '--source',
    'source',
    '--output',
    'archive.xz',
    '--format',
    'xz'
  ]);
  assertUsageFailure(writeFormat, ['INVALID_OPTION_VALUE']);

  const negativeLimit = runCli([
    'extract',
    '--input',
    'archive.zip',
    '--output',
    'out',
    '--max-extracted-file-bytes',
    '-1'
  ]);
  assertUsageFailure(negativeLimit, ['INVALID_OPTION_VALUE']);
});
