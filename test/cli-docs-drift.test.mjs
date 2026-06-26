import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '..');
const cliArgsPath = path.join(repoRoot, 'src', 'cli-args.ts');
const cliReferencePath = path.join(repoRoot, 'docs', 'cli.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('CLI reference documents all long flags from CLI schema', () => {
  const cliArgsSource = read(cliArgsPath);
  const cliDocs = read(cliReferencePath);

  const matches = cliArgsSource.match(/'--[a-z0-9-]+'/g) ?? [];
  const flags = [...new Set(matches.map((entry) => entry.slice(1, -1)))].sort();
  const missing = flags.filter((flag) => !cliDocs.includes(flag));

  assert.equal(
    missing.length,
    0,
    `docs/cli.md is missing CLI flags: ${missing.join(', ')}`,
  );
});

test('CLI reference documents all supported commands', () => {
  const cliArgsSource = read(cliArgsPath);
  const cliDocs = read(cliReferencePath);

  const commandsBlock = cliArgsSource.match(/const SUPPORTED_COMMANDS = new Set\(\[([^\]]+)\]\);/);
  assert.ok(commandsBlock, 'Unable to locate SUPPORTED_COMMANDS in src/cli-args.ts');

  const commandMatches = commandsBlock[1].match(/'([a-z]+)'/g) ?? [];
  const commands = [...new Set(commandMatches.map((entry) => entry.slice(1, -1)))].sort();
  const missing = commands.filter((command) => !cliDocs.includes(`\`${command}\``));

  assert.equal(
    missing.length,
    0,
    `docs/cli.md is missing commands: ${missing.join(', ')}`,
  );
});
