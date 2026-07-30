import assert from 'node:assert/strict';
import {
  createWriteStream,
  existsSync,
  mkdtempSync,
  readlinkSync,
  rmSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createArchiveWriter } from '@ismail-elkorchi/bytefold';
import { extract } from '../dist/index.js';
import { DirArchiverError } from '../dist/errors.js';

const encoder = new TextEncoder();

const cleanup = (target) => {
  rmSync(target, { recursive: true, force: true });
};

const buildZip = async (targetPath, entries) => {
  const writable = Writable.toWeb(createWriteStream(targetPath));
  const writer = createArchiveWriter('zip', writable);
  for (const entry of entries) {
    await writer.add(entry.name, encoder.encode(entry.content));
  }
  await writer.close();
};

const buildTar = async (targetPath, entries) => {
  const writable = Writable.toWeb(createWriteStream(targetPath));
  const writer = createArchiveWriter('tar', writable);
  for (const entry of entries) {
    await writer.add(
      entry.name,
      entry.content === undefined ? undefined : encoder.encode(entry.content),
      entry.options
    );
  }
  await writer.close();
};

test('extract rejects traversal and absolute entry paths', async () => {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-security-'));
  try {
    const archive = path.join(tmpRoot, 'traversal.zip');
    await buildZip(archive, [
      { name: '../escape.txt', content: 'x' }
    ]);

    await assert.rejects(
      async () => extract(archive, path.join(tmpRoot, 'out'), { safetyProfile: 'strict' }),
      (error) => error instanceof DirArchiverError && error.code === 'DIRARCHIVER_PATH_TRAVERSAL'
    );

    const absoluteArchive = path.join(tmpRoot, 'absolute.zip');
    await buildZip(absoluteArchive, [
      { name: '/abs.txt', content: 'x' }
    ]);

    await assert.rejects(
      async () => extract(absoluteArchive, path.join(tmpRoot, 'out-abs'), { safetyProfile: 'strict' }),
      (error) => error instanceof DirArchiverError && error.code === 'DIRARCHIVER_PATH_TRAVERSAL'
    );
  } finally {
    cleanup(tmpRoot);
  }
});

test('extract enforces decompression byte budgets', async () => {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-security-'));
  try {
    const archive = path.join(tmpRoot, 'budget.zip');
    await buildZip(archive, [
      { name: 'big.txt', content: '12345678901234567890' }
    ]);

    await assert.rejects(
      async () => extract(archive, path.join(tmpRoot, 'budget-out'), {
        safetyProfile: 'strict',
        maxExtractedFileBytes: 8
      }),
      (error) => error instanceof DirArchiverError && error.code === 'DIRARCHIVER_RESOURCE_LIMIT'
    );
  } finally {
    cleanup(tmpRoot);
  }
});

test('extract enforces the cumulative materialization byte budget', async () => {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-security-'));
  try {
    const archive = path.join(tmpRoot, 'total-budget.zip');
    await buildZip(archive, [
      { name: 'first.txt', content: '1234' },
      { name: 'second.txt', content: '5678' }
    ]);

    await assert.rejects(
      extract(archive, path.join(tmpRoot, 'total-budget-out'), {
        safetyProfile: 'strict',
        maxTotalExtractedBytes: 7
      }),
      (error) => error instanceof DirArchiverError
        && error.code === 'DIRARCHIVER_RESOURCE_LIMIT'
    );
  } finally {
    cleanup(tmpRoot);
  }
});

test('extract rejects invalid materialization limits before opening the input', async () => {
  await assert.rejects(
    extract('missing.zip', 'out', { maxExtractedFileBytes: -1 }),
    (error) =>
      error instanceof TypeError
      && error.message === 'maxExtractedFileBytes must be a non-negative safe integer.'
  );
});

test('extract rejects duplicate/conflicting names under strict profile', async () => {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-security-'));
  try {
    const archive = path.join(tmpRoot, 'duplicate.zip');
    await buildZip(archive, [
      { name: 'dup.txt', content: 'one' },
      { name: 'dup.txt', content: 'two' }
    ]);

    await assert.rejects(
      async () => extract(archive, path.join(tmpRoot, 'dup-out'), { safetyProfile: 'untrusted' }),
      (error) => error instanceof DirArchiverError && error.code === 'DIRARCHIVER_UNSUPPORTED_ENTRY'
    );
  } finally {
    cleanup(tmpRoot);
  }
});

test('extract skips symlinks by default', async () => {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-security-'));
  try {
    const archive = path.join(tmpRoot, 'skipped-symlink.tar');
    await buildTar(archive, [
      { name: 'target.txt', content: 'target' },
      {
        name: 'link',
        options: { type: 'symlink', linkName: 'target.txt' }
      }
    ]);

    const destination = path.join(tmpRoot, 'skipped-symlink-out');
    const result = await extract(archive, destination, {
      safetyProfile: 'compatible'
    });

    assert.equal(result.extractedFileCount, 1);
    assert.equal(result.extractedSymlinkCount, 0);
    assert.equal(result.skippedEntryCount, 1);
    assert.equal(existsSync(path.join(destination, 'link')), false);
  } finally {
    cleanup(tmpRoot);
  }
});

test(
  'extract preserves a current-directory symlink target',
  { skip: process.platform === 'win32' },
  async () => {
    const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-security-'));
    try {
      const archive = path.join(tmpRoot, 'dot-symlink.tar');
      await buildTar(archive, [
        {
          name: 'link',
          options: { type: 'symlink', linkName: '.' }
        }
      ]);

      const destination = path.join(tmpRoot, 'dot-symlink-out');
      const result = await extract(archive, destination, {
        safetyProfile: 'compatible',
        allowSymlinks: true
      });

      assert.equal(result.extractedSymlinkCount, 1);
      assert.equal(result.skippedEntryCount, 0);
      assert.equal(readlinkSync(path.join(destination, 'link')), '.');
    } finally {
      cleanup(tmpRoot);
    }
  }
);

test('extract rejects hard links with a structured package error', async () => {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-security-'));
  try {
    const archive = path.join(tmpRoot, 'hard-link.tar');
    await buildTar(archive, [
      { name: 'target.txt', content: 'target' },
      {
        name: 'hard-link.txt',
        options: { type: 'link', linkName: 'target.txt' }
      }
    ]);

    await assert.rejects(
      extract(archive, path.join(tmpRoot, 'hard-link-out'), {
        safetyProfile: 'compatible'
      }),
      (error) => error instanceof DirArchiverError
        && error.code === 'DIRARCHIVER_UNSUPPORTED_ENTRY'
    );
  } finally {
    cleanup(tmpRoot);
  }
});

test('extract rejects a non-directory entry that resolves to the extraction root', async () => {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-security-'));
  try {
    const archive = path.join(tmpRoot, 'root-file.tar');
    await buildTar(archive, [
      { name: '.', content: 'not a directory', options: { type: 'file' } }
    ]);

    await assert.rejects(
      extract(archive, path.join(tmpRoot, 'root-file-out'), {
        safetyProfile: 'compatible'
      }),
      (error) => error instanceof DirArchiverError
        && error.code === 'DIRARCHIVER_UNSUPPORTED_ENTRY'
        && error.message
          === 'Non-directory archive entry "." resolves to the extraction root.'
    );
  } finally {
    cleanup(tmpRoot);
  }
});

test('extract accepts a directory entry that resolves to the extraction root', async () => {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-security-'));
  try {
    const archive = path.join(tmpRoot, 'root-directory.tar');
    await buildTar(archive, [
      { name: '.', options: { type: 'directory' } }
    ]);

    const destination = path.join(tmpRoot, 'root-directory-out');
    const result = await extract(archive, destination, {
      safetyProfile: 'compatible'
    });

    assert.equal(result.extractedDirectoryCount, 1);
    assert.equal(existsSync(destination), true);
  } finally {
    cleanup(tmpRoot);
  }
});
