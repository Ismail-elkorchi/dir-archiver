import { readFile } from 'node:fs/promises';
import {
  formatPullRequestSection,
  ghApiJson,
  loadExpectedPullRequests,
  loadRepositoryTags,
  normalizeTag,
  parsePullRequestReferences,
  resolvePreviousTag,
  resolveRepository
} from './release-prs-lib.mjs';

const run = async () => {
  const cli = parseCli(process.argv.slice(2));
  const repository = await resolveRepository();

  if (cli.printPrSection) {
    const tagName = normalizeTag(cli.tag ?? process.env.GITHUB_REF_NAME ?? '');
    if (!tagName.startsWith('v')) {
      throw new Error(
        `[release-audit] expected v-prefixed tag for --print-pr-section, received "${tagName}"`
      );
    }
    const tags = await loadRepositoryTags(repository);
    const previousTag = resolvePreviousTag(tags, tagName);
    const expectedPullRequests = await loadExpectedPullRequests({
      repository,
      latestTag: tagName,
      previousTag
    });
    process.stdout.write(formatPullRequestSection(expectedPullRequests));
    return;
  }

  await runStrictAudit(repository);
};

async function runStrictAudit(repository) {
  const latestRelease = await ghApiJson(`repos/${repository}/releases/latest`);
  const tags = await loadRepositoryTags(repository);
  const latestTag = tags[0]?.name;

  if (!latestTag) {
    throw new Error('[release-audit] no tags found in repository');
  }

  if (latestRelease.tag_name !== latestTag) {
    throw new Error(
      `[release-audit] latest release/tag mismatch (release=${latestRelease.tag_name}, tag=${latestTag})`
    );
  }

  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  const expectedTag = `v${packageJson.version}`;
  if (latestTag !== expectedTag) {
    throw new Error(
      `[release-audit] package/tag mismatch (package=${packageJson.version}, tag=${latestTag})`
    );
  }

  const previousTag = resolvePreviousTag(tags, latestTag);
  const expectedPullRequests = await loadExpectedPullRequests({
    repository,
    latestTag,
    previousTag
  });
  if (expectedPullRequests.length === 0) {
    throw new Error(
      `[release-audit] no pull requests detected for ${latestTag}; strict audit requires PR-linked release history`
    );
  }

  const changelog = await readFile('CHANGELOG.md', 'utf8');
  if (!hasChangelogSection(changelog, packageJson.version)) {
    throw new Error(
      `[release-audit] CHANGELOG.md missing section for version ${packageJson.version}`
    );
  }

  const expectedIds = new Set(expectedPullRequests.map((pull) => pull.number));
  const actualPullRequests = parsePullRequestReferences(String(latestRelease.body ?? ''));
  const missing = difference(expectedIds, actualPullRequests);
  const unexpected = difference(actualPullRequests, expectedIds);
  if (missing.length > 0 || unexpected.length > 0) {
    const segments = [];
    if (missing.length > 0) {
      segments.push(`missing=${missing.map((id) => `#${id}`).join(',')}`);
    }
    if (unexpected.length > 0) {
      segments.push(`unexpected=${unexpected.map((id) => `#${id}`).join(',')}`);
    }
    throw new Error(
      `[release-audit] release body PR set mismatch for ${latestTag} (${segments.join(' ')})`
    );
  }

  process.stdout.write(
    `[release-audit] ok repo=${repository} tag=${latestTag} version=${packageJson.version} prs=${expectedPullRequests.length}\n`
  );
}

function parseCli(args) {
  let printPrSection = false;
  let tag = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--print-pr-section') {
      printPrSection = true;
      continue;
    }
    if (arg === '--tag') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('[release-audit] --tag expects a value');
      }
      tag = value;
      index += 1;
      continue;
    }
    throw new Error(`[release-audit] unknown argument: ${arg}`);
  }

  return { printPrSection, tag };
}

function hasChangelogSection(changelog, version) {
  const normalized = changelog.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!(line.startsWith('## ') || line.startsWith('### '))) {
      continue;
    }
    const heading = line.replace(/^#{2,3}\s+/, '').trim();
    const withoutV = heading.startsWith('v') ? heading.slice(1) : heading;
    if (withoutV === version) {
      return true;
    }
    if (withoutV.startsWith(`${version} `)) {
      return true;
    }
    if (withoutV.startsWith(`${version} (`)) {
      return true;
    }
    if (withoutV.startsWith(`${version}-`)) {
      return true;
    }
  }
  return false;
}

function difference(left, right) {
  return [...left].filter((value) => !right.has(value)).sort((a, b) => a - b);
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
