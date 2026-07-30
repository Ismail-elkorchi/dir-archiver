import assert from 'node:assert/strict';
import test from 'node:test';
import { DirArchiverError } from '../dist/index.js';

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
