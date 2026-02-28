import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createArchiveWriter } from '@ismail-elkorchi/bytefold/node';
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

test('extract rejects traversal and absolute entry paths', async () => {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-security-'));
  try {
    const archive = path.join(tmpRoot, 'traversal.zip');
    await buildZip(archive, [
      { name: '../escape.txt', content: 'x' }
    ]);

    await assert.rejects(
      async () => extract(archive, path.join(tmpRoot, 'out'), { profile: 'strict' }),
      (error) => error instanceof DirArchiverError && error.code === 'DIRARCHIVER_PATH_TRAVERSAL'
    );

    const absoluteArchive = path.join(tmpRoot, 'absolute.zip');
    await buildZip(absoluteArchive, [
      { name: '/abs.txt', content: 'x' }
    ]);

    await assert.rejects(
      async () => extract(absoluteArchive, path.join(tmpRoot, 'out-abs'), { profile: 'strict' }),
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
        profile: 'strict',
        maxEntryBytes: 8
      }),
      (error) => error instanceof DirArchiverError && error.code === 'DIRARCHIVER_RESOURCE_LIMIT'
    );
  } finally {
    cleanup(tmpRoot);
  }
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
      async () => extract(archive, path.join(tmpRoot, 'dup-out'), { profile: 'agent' }),
      (error) => error instanceof DirArchiverError && error.code === 'DIRARCHIVER_UNSUPPORTED_ENTRY'
    );
  } finally {
    cleanup(tmpRoot);
  }
});
