import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runtimeSupport, supportMatrix } from '@ismail-elkorchi/bytefold/support';
import { detect, list, write } from '../dist/index.js';
import { DirArchiverError } from '../dist/errors.js';

const cleanup = (target) => {
  rmSync(target, { recursive: true, force: true });
};

test('node matrix covers support-derived write/read scenarios', async () => {
  const nodeSupport = runtimeSupport('node');
  const candidateFormats = supportMatrix.formats.filter((format) => {
    const writeState = nodeSupport[format].write.state;
    const listState = nodeSupport[format].list.state;
    return writeState === 'supported' && (listState === 'supported' || listState === 'hint-required');
  }).slice(0, 4);

  for (const format of candidateFormats) {
    const tmpRoot = mkdtempSync(path.join(tmpdir(), `dir-archiver-matrix-${format.replace('/', '-')}-`));
    try {
      const source = path.join(tmpRoot, 'input.txt');
      writeFileSync(source, `payload-${format}`);
      const archive = path.join(tmpRoot, `bundle.${format.replace('/', '.')}`);

      await write(source, archive, { format });
      const openOptions = nodeSupport[format].detect.state === 'hint-required' ? { format } : {};
      const detected = await detect(archive, openOptions);
      assert.equal(isFormatEquivalent(detected.format, format), true);

      const listed = await list(archive, openOptions);
      assert.equal(listed.entries.length > 0, true);
    } finally {
      cleanup(tmpRoot);
    }
  }
});

const isFormatEquivalent = (actual, expected) => {
  if (actual === expected) {
    return true;
  }
  return (actual === 'tgz' && expected === 'tar.gz') || (actual === 'tar.gz' && expected === 'tgz');
};

test('node matrix unsupported write formats fail with stable code', async () => {
  const nodeSupport = runtimeSupport('node');
  const unsupportedFormat = supportMatrix.formats.find((format) => nodeSupport[format].write.state === 'unsupported');
  assert.ok(unsupportedFormat, 'expected at least one unsupported write format');

  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-matrix-unsupported-'));
  try {
    const source = path.join(tmpRoot, 'source');
    mkdirSync(source, { recursive: true });
    writeFileSync(path.join(source, 'input.txt'), 'payload');
    const archive = path.join(tmpRoot, 'out.archive');

    await assert.rejects(
      async () => {
        await write(source, archive, { format: unsupportedFormat });
      },
      (error) => error instanceof DirArchiverError && error.code === 'DIRARCHIVER_UNSUPPORTED_ENTRY'
    );
  } finally {
    cleanup(tmpRoot);
  }
});
