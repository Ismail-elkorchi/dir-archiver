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

test('unknown flag returns usage exit code and UNKNOWN_FLAG issue', () => {
  const result = runCli(['detect', '--input', 'archive.zip', '--unknown', '1', '--json']);
  assert.equal(result.status, 2);
  const payload = JSON.parse(result.stdout.trim());
  const issue = payload.issues.find((candidate) => candidate.code === 'UNKNOWN_FLAG');
  assert.deepEqual(
    {
      argument: issue.argument,
      flag: issue.flag,
      index: issue.index
    },
    {
      argument: '--unknown',
      flag: '--unknown',
      index: 3
    }
  );
});

test('write and extract commands succeed in JSON mode', () => {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-cli-test-'));
  try {
    const source = path.join(tmpRoot, 'src');
    mkdirSync(source, { recursive: true });
    writeFileSync(path.join(source, 'hello.txt'), 'hello');

    const archive = path.join(tmpRoot, 'archive.zip');
    const writeResult = runCli(['write', '-s', source, '-o', archive, '--json']);
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
  assert.equal(result.status, 2);
  const payload = JSON.parse(result.stdout.trim());
  assert.equal(
    payload.issues.some((issue) => issue.code === 'DUPLICATE_OPTION'),
    true
  );
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
  assert.equal(aliasResult.status, 2);
  const aliasPayload = JSON.parse(aliasResult.stdout.trim());
  assert.equal(
    aliasPayload.issues.filter((issue) => issue.code === 'UNKNOWN_FLAG').length,
    2
  );

  const implicitResult = runCli([
    '--source',
    'source',
    '--output',
    'archive.zip',
    '--json'
  ]);
  assert.equal(implicitResult.status, 2);
  const implicitPayload = JSON.parse(implicitResult.stdout.trim());
  assert.equal(
    implicitPayload.issues.some((issue) => issue.code === 'MISSING_COMMAND'),
    true
  );
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
  assert.equal(profileResult.status, 2);
  const profilePayload = JSON.parse(profileResult.stdout.trim());
  assert.equal(
    profilePayload.issues.some((issue) => issue.code === 'INVALID_OPTION_VALUE'),
    true
  );
  assert.equal(Object.hasOwn(profilePayload, 'safetyProfile'), false);

  const boundaryResult = runCli([
    'detect',
    '--input',
    'archive.zip',
    '--json',
    '--',
    'extra'
  ]);
  assert.equal(boundaryResult.status, 2);
  const boundaryPayload = JSON.parse(boundaryResult.stdout.trim());
  assert.equal(
    boundaryPayload.issues.some(
      (issue) => issue.code === 'UNEXPECTED_ARGUMENT_AFTER_DOUBLE_DASH'
    ),
    true
  );
});

test('options that do not belong to a command are rejected', () => {
  const result = runCli([
    'detect',
    '--input',
    'archive.zip',
    '--allow-symlinks',
    '--json'
  ]);
  assert.equal(result.status, 2);
  const payload = JSON.parse(result.stdout.trim());
  assert.equal(
    payload.issues.some((issue) => issue.code === 'OPTION_NOT_ALLOWED'),
    true
  );
});
