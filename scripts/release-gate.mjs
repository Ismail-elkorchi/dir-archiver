import { readFile } from 'node:fs/promises';

const run = async () => {
  const tagInput = process.argv[2] ?? process.env.GITHUB_REF_NAME ?? '';
  const tagName = normalizeTag(tagInput);
  if (!tagName.startsWith('v')) {
    throw new Error(`release-gate: expected v-prefixed tag, received "${tagName}"`);
  }

  const version = tagName.slice(1);
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  const jsrJson = JSON.parse(await readFile('jsr.json', 'utf8'));
  if (packageJson.version !== version) {
    throw new Error(
      `release-gate: tag/version mismatch (tag=${version}, package.json=${packageJson.version})`
    );
  }
  if (jsrJson.version !== version) {
    throw new Error(
      `release-gate: tag/version mismatch (tag=${version}, jsr.json=${jsrJson.version})`
    );
  }

  const changelog = await readFile('CHANGELOG.md', 'utf8');
  const sectionPattern = new RegExp(
    `^#{2,3}\\s+v?${escapeRegExp(version)}(?:\\b|\\s|\\(|-|$)`,
    'm'
  );
  if (!sectionPattern.test(changelog)) {
    throw new Error(`release-gate: missing CHANGELOG section for version ${version}`);
  }

  process.stdout.write(
    `release-gate: ok tag=${tagName} package=${packageJson.version} jsr=${jsrJson.version} changelog=present\n`
  );
};

function normalizeTag(value) {
  if (!value) {
    return '';
  }
  if (value.startsWith('refs/tags/')) {
    return value.slice('refs/tags/'.length);
  }
  return value;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
