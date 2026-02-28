import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const tempDir = mkdtempSync(path.join(tmpdir(), 'dir-archiver-runtime-fp-'));
const nodeOut = path.join(tempDir, 'node.json');
const denoOut = path.join(tempDir, 'deno.json');
const bunOut = path.join(tempDir, 'bun.json');

try {
  run([process.execPath, ['scripts/runtime-fingerprint.mjs', '--out', nodeOut]], 'node');
  run(['deno', ['run', '--allow-read', '--allow-write', '--allow-env', '--allow-sys', 'scripts/runtime-fingerprint.mjs', '--out', denoOut]], 'deno');
  run(['bun', ['scripts/runtime-fingerprint.mjs', '--out', bunOut]], 'bun');

  const nodeResult = JSON.parse(readFileSync(nodeOut, 'utf8'));
  const denoResult = JSON.parse(readFileSync(denoOut, 'utf8'));
  const bunResult = JSON.parse(readFileSync(bunOut, 'utf8'));

  const fingerprintSet = new Set([nodeResult.fingerprint, denoResult.fingerprint, bunResult.fingerprint]);
  if (fingerprintSet.size !== 1) {
    throw new Error(
      `runtime fingerprint mismatch: node=${nodeResult.fingerprint} deno=${denoResult.fingerprint} bun=${bunResult.fingerprint}`
    );
  }

  process.stdout.write(`runtime-fingerprints: ${nodeResult.fingerprint}\n`);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

function run([command, args], label) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
  if (result.status === 0) {
    return;
  }
  const stderr = result.stderr || '';
  const stdout = result.stdout || '';
  throw new Error(`${label} fingerprint command failed (status=${result.status})\n${stdout}\n${stderr}`);
}
