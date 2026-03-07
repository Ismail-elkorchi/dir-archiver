import { readFile } from 'node:fs/promises';
import {
  formatPullRequestSection,
  loadExpectedPullRequests,
  loadRepositoryTags,
  normalizeTag,
  resolvePreviousTag,
  resolveRepository
} from './release-prs-lib.mjs';

const run = async () => {
  const cli = parseCli(process.argv.slice(2));
  const repository = cli.repository ?? await resolveRepository();
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  const tagName = normalizeTag(
    cli.tag
      ?? process.env.TAG_NAME
      ?? process.env.GITHUB_REF_NAME
      ?? `v${packageJson.version}`
  );
  if (!tagName.startsWith('v')) {
    throw new Error(`[changelog-update] expected v-prefixed tag, received "${tagName}"`);
  }

  const tags = await loadRepositoryTags(repository);
  const previousTag = resolvePreviousTag(tags, tagName);
  const pulls = await loadExpectedPullRequests({
    repository,
    latestTag: tagName,
    previousTag
  });

  process.stdout.write(formatPullRequestSection(pulls));
};

function parseCli(args) {
  let dryRun = false;
  let repository = null;
  let tag = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--repository') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('[changelog-update] --repository expects a value');
      }
      repository = value;
      index += 1;
      continue;
    }
    if (arg === '--tag') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('[changelog-update] --tag expects a value');
      }
      tag = value;
      index += 1;
      continue;
    }
    throw new Error(`[changelog-update] unknown argument: ${arg}`);
  }

  return { dryRun, repository, tag };
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
