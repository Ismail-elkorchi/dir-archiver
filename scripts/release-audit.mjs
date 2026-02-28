import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const run = async () => {
  const repository = await resolveRepository();
  const latestRelease = await ghApiJson(`repos/${repository}/releases/latest`);
  const latestTags = await ghApiJson(`repos/${repository}/tags?per_page=1`);
  const latestTag = latestTags[0]?.name;

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

  const changelog = await readFile('CHANGELOG.md', 'utf8');
  if (!hasChangelogSection(changelog, packageJson.version)) {
    throw new Error(
      `[release-audit] CHANGELOG.md missing section for version ${packageJson.version}`
    );
  }

  const releaseBody = String(latestRelease.body ?? '');
  if (!containsPullRequestReference(releaseBody)) {
    throw new Error(
      `[release-audit] latest release body for ${latestTag} is missing pull request references`
    );
  }

  process.stdout.write(
    `[release-audit] ok repo=${repository} tag=${latestTag} version=${packageJson.version}\n`
  );
};

async function ghApiJson(pathname) {
  const args = ['api', pathname];
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const environment = token
    ? { ...process.env, GH_TOKEN: token }
    : process.env;
  const { stdout } = await execFileAsync('gh', args, { encoding: 'utf8', env: environment });
  return JSON.parse(stdout);
}

async function resolveRepository() {
  const explicit = process.env.GITHUB_REPOSITORY?.trim();
  if (explicit) {
    return explicit;
  }

  const { stdout } = await execFileAsync(
    'git',
    ['remote', 'get-url', 'origin'],
    { encoding: 'utf8' }
  );
  const remote = stdout.trim();
  return normalizeRepositoryFromRemote(remote);
}

function normalizeRepositoryFromRemote(remote) {
  const noGitSuffix = remote.endsWith('.git') ? remote.slice(0, -4) : remote;
  if (noGitSuffix.startsWith('git@github.com:')) {
    return noGitSuffix.slice('git@github.com:'.length);
  }
  if (noGitSuffix.startsWith('https://github.com/')) {
    return noGitSuffix.slice('https://github.com/'.length);
  }
  throw new Error(`[release-audit] unsupported origin remote format: ${remote}`);
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

function containsPullRequestReference(value) {
  return /#[0-9]+/.test(value) || /\/pull\/[0-9]+/.test(value);
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
