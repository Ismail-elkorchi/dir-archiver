import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  audit,
  detect,
  DirArchiverError,
  extract,
  list,
  normalize,
  write
} from '../dist/index.js';

const removeDir = (dirPath) => {
  rmSync(dirPath, { recursive: true, force: true });
};

test('write/detect/list/audit/extract/normalize flow on zip', async () => {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-v3-'));
  try {
    const source = path.join(tmpRoot, 'source');
    const nested = path.join(source, 'nested');
    mkdirSync(nested, { recursive: true });
    writeFileSync(path.join(source, 'root.txt'), 'root');
    writeFileSync(path.join(source, 'skip.txt'), 'skip');
    writeFileSync(path.join(nested, 'nested.txt'), 'nested');

    const archive = path.join(tmpRoot, 'bundle.zip');
    const writeResult = await write(source, archive, {
      format: 'zip',
      includeBaseDirectory: true,
      exclude: ['skip.txt']
    });
    assert.equal(writeResult.format, 'zip');
    assert.equal(writeResult.entryCount, 2);
    assert.equal(existsSync(archive), true);

    const detectResult = await detect(archive, {});
    assert.equal(detectResult.format, 'zip');

    const listed = await list(archive, {});
    assert.equal(listed.format, 'zip');
    assert.equal(listed.entries.some((entry) => entry.name.endsWith('/skip.txt')), false);
    assert.equal(listed.entries.some((entry) => entry.name.endsWith('/root.txt')), true);

    const auditReport = await audit(archive, { profile: 'strict' });
    assert.equal(auditReport.ok, true);

    const extractTarget = path.join(tmpRoot, 'extracted');
    const extractResult = await extract(archive, extractTarget, { profile: 'strict' });
    assert.equal(extractResult.extractedFiles, 2);
    const extractedRoot = path.join(extractTarget, path.basename(source), 'root.txt');
    assert.equal(readFileSync(extractedRoot, 'utf8'), 'root');

    const normalizedTarget = path.join(tmpRoot, 'normalized.zip');
    const normalizeResult = await normalize(archive, normalizedTarget, { deterministic: true });
    assert.equal(normalizeResult.format, 'zip');
    assert.equal(existsSync(normalizedTarget), true);
  } finally {
    removeDir(tmpRoot);
  }
});

test('directory + single-file codec wraps into tar.<codec>', async () => {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-v3-'));
  try {
    const source = path.join(tmpRoot, 'source');
    mkdirSync(source, { recursive: true });
    writeFileSync(path.join(source, 'hello.txt'), 'hello');

    const archive = path.join(tmpRoot, 'wrapped.gz');
    const result = await write(source, archive, { format: 'gz' });
    assert.equal(result.format, 'tar.gz');
    assert.equal(result.wrappedDirectoryCodec, true);
  } finally {
    removeDir(tmpRoot);
  }
});

test('unsupported write formats fail with the public error code', async () => {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-v3-'));
  try {
    const source = path.join(tmpRoot, 'source');
    mkdirSync(source);
    writeFileSync(path.join(source, 'hello.txt'), 'hello');

    await assert.rejects(
      write(source, path.join(tmpRoot, 'archive.xz'), { format: 'xz' }),
      (error) =>
        error instanceof DirArchiverError
        && error.code === 'DIRARCHIVER_UNSUPPORTED_ENTRY'
    );
  } finally {
    removeDir(tmpRoot);
  }
});

test('gzip-compressed TAR reads as tgz and normalizes to inner TAR bytes', async () => {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-v3-'));
  try {
    const source = path.join(tmpRoot, 'source');
    mkdirSync(source, { recursive: true });
    writeFileSync(path.join(source, 'hello.txt'), 'hello');

    const archive = path.join(tmpRoot, 'source.tar.gz');
    const writeResult = await write(source, archive, { format: 'tar.gz' });
    assert.equal(writeResult.format, 'tar.gz');

    const inferred = await detect(archive);
    assert.equal(inferred.format, 'tgz');

    const forced = await detect(archive, { format: 'tar.gz' });
    assert.equal(forced.format, 'tgz');

    const normalized = path.join(tmpRoot, 'normalized.tar');
    const normalizeResult = await normalize(archive, normalized, { deterministic: true });
    assert.equal(normalizeResult.format, 'tgz');

    const normalizedDetection = await detect(normalized);
    assert.equal(normalizedDetection.format, 'tar');

    const normalizedEntries = await list(normalized);
    assert.equal(normalizedEntries.entries.some((entry) => entry.name === 'hello.txt'), true);
  } finally {
    removeDir(tmpRoot);
  }
});
