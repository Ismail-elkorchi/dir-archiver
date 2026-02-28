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
  const issueCodes = payload.issues.map((issue) => issue.code);
  assert.equal(issueCodes.includes('UNKNOWN_FLAG'), true);
});

test('write and extract commands succeed in JSON mode', () => {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-cli-v3-'));
  try {
    const source = path.join(tmpRoot, 'src');
    mkdirSync(source, { recursive: true });
    writeFileSync(path.join(source, 'hello.txt'), 'hello');

    const archive = path.join(tmpRoot, 'archive.zip');
    const writeResult = runCli(['write', '--source', source, '--output', archive, '--json']);
    assert.equal(writeResult.status, 0);

    const extracted = path.join(tmpRoot, 'out');
    const extractResult = runCli([
      'extract',
      '--input',
      archive,
      '--output',
      extracted,
      '--profile',
      'strict',
      '--json'
    ]);
    assert.equal(extractResult.status, 0);

    const extractedFile = path.join(extracted, 'hello.txt');
    assert.equal(readFileSync(extractedFile, 'utf8'), 'hello');
  } finally {
    cleanup(tmpRoot);
  }
});
