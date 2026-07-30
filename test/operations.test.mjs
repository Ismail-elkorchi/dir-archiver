import assert from 'node:assert/strict';
import {
  createWriteStream,
  existsSync,
  linkSync,
  mkdtempSync,
  mkdirSync,
  promises as fsPromises,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createArchiveWriter } from '@ismail-elkorchi/bytefold';
import {
  audit,
  detect,
  extract,
  list,
  normalize,
  write
} from '../dist/index.js';

const removeDir = (dirPath) => {
  rmSync(dirPath, { recursive: true, force: true });
};

test('write/detect/list/audit/extract/normalize flow on zip', async () => {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-test-'));
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

    const auditReport = await audit(archive, { safetyProfile: 'strict' });
    assert.equal(auditReport.isSafe, true);

    const extractTarget = path.join(tmpRoot, 'extracted');
    const extractResult = await extract(archive, extractTarget, { safetyProfile: 'strict' });
    assert.equal(extractResult.extractedFileCount, 2);
    assert.equal(extractResult.extractedDirectoryCount, 0);
    assert.equal(extractResult.extractedSymlinkCount, 0);
    assert.equal(extractResult.skippedEntryCount, 0);
    const extractedRoot = path.join(extractTarget, path.basename(source), 'root.txt');
    assert.equal(readFileSync(extractedRoot, 'utf8'), 'root');

    const normalizedTarget = path.join(tmpRoot, 'normalized.zip');
    const normalizeResult = await normalize(archive, normalizedTarget, { isDeterministic: true });
    assert.equal(normalizeResult.format, 'zip');
    assert.equal(existsSync(normalizedTarget), true);
  } finally {
    removeDir(tmpRoot);
  }
});

test('write accepts Bytefold archive writer formats', async () => {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-test-'));
  try {
    const source = path.join(tmpRoot, 'source');
    mkdirSync(source, { recursive: true });
    writeFileSync(path.join(source, 'hello.txt'), 'hello');

    const archive = path.join(tmpRoot, 'wrapped.tar.gz');
    const result = await write(source, archive, { format: 'tar.gz' });
    assert.equal(result.format, 'tar.gz');
  } finally {
    removeDir(tmpRoot);
  }
});

test('write collects source entries before creating a destination inside the source', async () => {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-test-'));
  try {
    const source = path.join(tmpRoot, 'source');
    mkdirSync(source);
    writeFileSync(path.join(source, 'hello.txt'), 'hello');

    const archive = path.join(source, 'archive.zip');
    writeFileSync(archive, 'previous archive');
    const result = await write(source, archive);
    assert.equal(result.entryCount, 1);
    const listing = await list(archive);
    assert.deepEqual(listing.entries.map((entry) => entry.name), ['hello.txt']);
  } finally {
    removeDir(tmpRoot);
  }
});

test('write aborts and releases the destination after a source read failure', async () => {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-test-'));
  const originalReadFile = fsPromises.readFile;
  try {
    const source = path.join(tmpRoot, 'source');
    mkdirSync(source);
    writeFileSync(path.join(source, 'first.txt'), 'first');
    writeFileSync(path.join(source, 'second.txt'), 'second');

    const sourceError = new Error('source read failed');
    let readCount = 0;
    fsPromises.readFile = async (...arguments_) => {
      readCount += 1;
      if (readCount === 2) throw sourceError;
      return originalReadFile(...arguments_);
    };

    const archive = path.join(tmpRoot, 'partial.zip');
    await assert.rejects(
      write(source, archive),
      (error) => error === sourceError
    );

    rmSync(archive);
    assert.equal(existsSync(archive), false);
  } finally {
    fsPromises.readFile = originalReadFile;
    removeDir(tmpRoot);
  }
});

test('write and normalize reject destructive same-path calls', async () => {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-test-'));
  try {
    const source = path.join(tmpRoot, 'source.txt');
    writeFileSync(source, 'hello');

    await assert.rejects(
      write(source, source),
      (error) =>
        error instanceof TypeError
        && error.message === 'Archive source and destination must be different paths.'
    );

    const archive = path.join(tmpRoot, 'archive.zip');
    await write(source, archive);
    await assert.rejects(
      normalize(archive, archive),
      (error) =>
        error instanceof TypeError
        && error.message === 'Normalize input and destination must be different paths.'
    );

    const sourceAlias = path.join(tmpRoot, 'source-alias.txt');
    linkSync(source, sourceAlias);
    await assert.rejects(
      write(source, sourceAlias),
      (error) =>
        error instanceof TypeError
        && error.message === 'Archive source and destination must be different paths.'
    );

    const archiveAlias = path.join(tmpRoot, 'archive-alias.zip');
    linkSync(archive, archiveAlias);
    await assert.rejects(
      normalize(archive, archiveAlias),
      (error) =>
        error instanceof TypeError
        && error.message === 'Normalize input and destination must be different paths.'
    );
  } finally {
    removeDir(tmpRoot);
  }
});

test('write rejects invalid exclusions before creating the destination', async () => {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-test-'));
  try {
    const source = path.join(tmpRoot, 'source');
    mkdirSync(source);
    writeFileSync(path.join(source, 'hello.txt'), 'hello');

    for (const exclusion of ['', '.', '..', '../outside', '/absolute', 'C:\\absolute']) {
      const archive = path.join(tmpRoot, `${encodeURIComponent(exclusion)}.zip`);
      await assert.rejects(
        write(source, archive, { exclude: [exclusion] }),
        (error) =>
          error instanceof TypeError
          && error.message
            === 'Each exclusion must be a non-empty source-relative basename or path.'
      );
      assert.equal(existsSync(archive), false);
    }
  } finally {
    removeDir(tmpRoot);
  }
});

test('normalize releases the destination after an entry failure', async () => {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-test-'));
  try {
    const archive = path.join(tmpRoot, 'symlink.tar');
    const writer = createArchiveWriter(
      'tar',
      Writable.toWeb(createWriteStream(archive))
    );
    await writer.add('link', undefined, {
      type: 'symlink',
      linkName: 'target'
    });
    await writer.close();

    const destination = path.join(tmpRoot, 'normalized.tar');
    await assert.rejects(normalize(archive, destination));
    rmSync(destination);
    assert.equal(existsSync(destination), false);
  } finally {
    removeDir(tmpRoot);
  }
});

test('gzip-compressed TAR reads as tgz and normalizes to inner TAR bytes', async () => {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-test-'));
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
    const normalizeResult = await normalize(archive, normalized, { isDeterministic: true });
    assert.equal(normalizeResult.format, 'tgz');

    const normalizedDetection = await detect(normalized);
    assert.equal(normalizedDetection.format, 'tar');

    const normalizedEntries = await list(normalized);
    assert.equal(normalizedEntries.entries.some((entry) => entry.name === 'hello.txt'), true);
  } finally {
    removeDir(tmpRoot);
  }
});
