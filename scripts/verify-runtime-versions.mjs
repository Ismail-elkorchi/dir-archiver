import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const run = async () => {
  const ROOT = process.cwd();
  const policyPath = path.join(ROOT, 'tools', 'runtime-versions.json');
  const policy = JSON.parse(await readFile(policyPath, 'utf8'));

  const targets = [
    { runtime: 'node', command: [process.execPath, ['--version']], parser: parseNodeVersion },
    { runtime: 'deno', command: ['deno', ['--version']], parser: parseDenoVersion },
    { runtime: 'bun', command: ['bun', ['--version']], parser: parseBunVersion }
  ];

  for (const target of targets) {
    const rule = policy[target.runtime];
    if (!rule || typeof rule.floor !== 'string') continue;
    const output = getVersionOutput(target.runtime, target.command[0], target.command[1], rule.floor);
    const actual = target.parser(output);
    const required = parseSemver(rule.floor);
    if (!actual || !required) {
      throw new Error(`${target.runtime} version parse failed (required ${rule.floor}).`);
    }
    if (compareSemver(actual, required) < 0) {
      throw new Error(`${target.runtime} ${actual.raw} does not satisfy floor ${rule.floor}.`);
    }
  }
};

function getVersionOutput(runtime, command, args, requiredFloor) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status === 0) {
    return result.stdout || result.stderr || '';
  }
  if (result.error) {
    throw new Error(`${runtime} is missing; required floor ${requiredFloor}`);
  }
  throw new Error(`${runtime} version check failed: ${result.stderr || 'unknown error'}`);
}

function parseNodeVersion(output) {
  const match = output.match(/v(\d+\.\d+\.\d+)/);
  return match ? parseSemver(match[1]) : null;
}

function parseDenoVersion(output) {
  const match = output.match(/deno\s+(\d+\.\d+\.\d+)/i);
  return match ? parseSemver(match[1]) : null;
}

function parseBunVersion(output) {
  const match = output.match(/(\d+\.\d+\.\d+)/);
  return match ? parseSemver(match[1]) : null;
}

function parseSemver(value) {
  const match = String(value).trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    raw: `${match[1]}.${match[2]}.${match[3]}`
  };
}

function compareSemver(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
