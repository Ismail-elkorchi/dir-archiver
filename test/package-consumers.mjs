import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-consumers-'));
const packageDirectory = path.join(temporaryRoot, 'packages');
const consumerDirectory = path.join(temporaryRoot, 'consumer');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const run = (command, arguments_, cwd, environment = {}) => {
  const result = spawnSync(command, arguments_, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      NO_COLOR: '1',
      ...environment
    }
  });

  if (result.status !== 0) {
    throw new Error([
      `${command} ${arguments_.join(' ')} failed with exit code ${result.status ?? 'unknown'}.`,
      result.stdout.trim(),
      result.stderr.trim()
    ].filter(Boolean).join('\n'));
  }
};

const pack = (packagePath, ignoreScripts = false) => {
  const before = new Set(readdirSync(packageDirectory));
  const arguments_ = [
    'pack',
    '--silent',
    '--pack-destination',
    packageDirectory
  ];
  if (ignoreScripts) {
    arguments_.push('--ignore-scripts');
  }
  arguments_.push(packagePath);

  run(npmCommand, arguments_, repositoryRoot);

  const created = readdirSync(packageDirectory).filter((entry) => !before.has(entry));
  if (created.length !== 1) {
    throw new Error(`Expected npm pack to create one tarball, received: ${created.join(', ')}`);
  }
  return path.join(packageDirectory, created[0]);
};

const consumerSource = `
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { detect, extract, list, write } from 'dir-archiver';

const runtime = process.argv[2] ?? 'unknown';
const temporaryRoot = mkdtempSync(path.join(tmpdir(), \`dir-archiver-\${runtime}-consumer-\`));

try {
  const source = path.join(temporaryRoot, 'source');
  mkdirSync(source);
  writeFileSync(path.join(source, 'hello.txt'), runtime);

  const archive = path.join(temporaryRoot, 'archive.zip');
  const writeResult = await write(source, archive, { format: 'zip' });
  assert.equal(writeResult.format, 'zip');
  assert.equal(writeResult.entryCount, 1);

  const detection = await detect(archive);
  assert.equal(detection.format, 'zip');

  const listing = await list(archive);
  assert.equal(listing.entries.length, 1);
  assert.equal(listing.entries[0]?.name, 'hello.txt');

  const destination = path.join(temporaryRoot, 'extracted');
  const extraction = await extract(archive, destination, { profile: 'strict' });
  assert.equal(extraction.extractedFiles, 1);
  assert.equal(readFileSync(path.join(destination, 'hello.txt'), 'utf8'), runtime);

  process.stdout.write(\`\${runtime} packed consumer passed\\n\`);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
`;

try {
  mkdirSync(packageDirectory);
  mkdirSync(consumerDirectory);

  const dirArchiverTarball = pack(repositoryRoot);
  const bytefoldTarball = pack(
    path.join(repositoryRoot, 'node_modules', '@ismail-elkorchi', 'bytefold'),
    true
  );
  const argvFlagsTarball = pack(
    path.join(repositoryRoot, 'node_modules', 'argv-flags'),
    true
  );

  writeFileSync(
    path.join(consumerDirectory, 'package.json'),
    `${JSON.stringify({
      name: 'dir-archiver-packed-consumer',
      private: true,
      type: 'module'
    }, null, 2)}\n`
  );
  writeFileSync(path.join(consumerDirectory, 'consumer.mjs'), consumerSource.trimStart());

  run(
    npmCommand,
    [
      'install',
      '--offline',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
      dirArchiverTarball,
      bytefoldTarball,
      argvFlagsTarball
    ],
    consumerDirectory,
    {
      npm_config_offline: 'true',
      npm_config_update_notifier: 'false'
    }
  );

  const consumerPath = path.join(consumerDirectory, 'consumer.mjs');
  run(process.execPath, [consumerPath, 'node'], consumerDirectory);
  run(
    'deno',
    [
      'run',
      '--cached-only',
      '--node-modules-dir=manual',
      '--allow-read',
      '--allow-write',
      '--allow-env',
      '--allow-sys',
      consumerPath,
      'deno'
    ],
    consumerDirectory,
    { DENO_NO_UPDATE_CHECK: '1' }
  );
  run('bun', ['run', '--no-install', consumerPath, 'bun'], consumerDirectory);

  process.stdout.write('packed consumers passed: Node.js, Deno, Bun\n');
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
