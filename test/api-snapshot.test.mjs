import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const SNAPSHOT = new URL('./fixtures/api-surface.v3.json', import.meta.url);

test('v3 export surface matches snapshot', async () => {
  const expected = JSON.parse(await readFile(SNAPSHOT, 'utf8'));
  const mod = await import('../dist/index.js');
  const actual = Object.keys(mod).sort();
  assert.deepEqual(actual, expected);
});
