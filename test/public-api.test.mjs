import assert from 'node:assert/strict';
import test from 'node:test';
import dirArchiver, {
  audit,
  detect,
  DirArchiverError,
  extract,
  list,
  normalize,
  open,
  write
} from '../dist/index.js';

test('default and named APIs expose the same operations', () => {
  assert.equal(dirArchiver.open, open);
  assert.equal(dirArchiver.detect, detect);
  assert.equal(dirArchiver.list, list);
  assert.equal(dirArchiver.audit, audit);
  assert.equal(dirArchiver.normalize, normalize);
  assert.equal(dirArchiver.extract, extract);
  assert.equal(dirArchiver.write, write);
});

test('DirArchiverError serializes its public fields', () => {
  const error = new DirArchiverError(
    'DIRARCHIVER_RESOURCE_LIMIT',
    'Archive entry exceeds the configured limit.',
    {
      hint: 'Increase the entry limit only for trusted input.',
      context: { entry: 'large.bin' }
    }
  );

  assert.deepEqual(error.toJSON(), {
    schemaVersion: '1',
    name: 'DirArchiverError',
    code: 'DIRARCHIVER_RESOURCE_LIMIT',
    message: 'Archive entry exceeds the configured limit.',
    hint: 'Increase the entry limit only for trusted input.',
    context: { entry: 'large.bin' }
  });
});
