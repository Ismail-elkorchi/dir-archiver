import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const PR_HASH_REFERENCE_PATTERN = /#([0-9]+)/g;
const PR_LINK_REFERENCE_PATTERN = /\/pull\/([0-9]+)/g;
const MAX_BOOTSTRAP_COMMIT_PAGES = 50;

export async function ghApiJson(pathname) {
  const args = ['api', pathname];
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const environment = token
    ? { ...process.env, GH_TOKEN: token }
    : process.env;
  const { stdout } = await execFileAsync('gh', args, { encoding: 'utf8', env: environment });
  return JSON.parse(stdout);
}

export async function resolveRepository() {
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

export function normalizeTag(value) {
  if (!value) {
    return '';
  }
  if (value.startsWith('refs/tags/')) {
    return value.slice('refs/tags/'.length);
  }
  return value;
}

export async function loadRepositoryTags(repository) {
  const tags = await ghApiJson(`repos/${repository}/tags?per_page=100`);
  if (!Array.isArray(tags)) {
    throw new Error('[release-audit] failed to load repository tags');
  }
  return tags;
}

export function resolvePreviousTag(tags, latestTag) {
  const index = tags.findIndex((entry) => entry?.name === latestTag);
  if (index === -1) {
    throw new Error(`[release-audit] tag ${latestTag} not found in repository tag list`);
  }
  for (let cursor = index + 1; cursor < tags.length; cursor += 1) {
    const candidate = tags[cursor]?.name;
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }
  return null;
}

export async function loadExpectedPullRequests({ repository, latestTag, previousTag }) {
  const commits = previousTag
    ? await loadCommitsBetweenTags(repository, previousTag, latestTag)
    : await loadCommitsThroughTag(repository, latestTag);

  const pullsByNumber = new Map();
  const unresolvedShas = [];

  for (const commit of commits) {
    const fromMessage = parsePullRequestReferences(commit.message);
    if (fromMessage.size > 0) {
      for (const number of fromMessage) {
        mergePullRecord(pullsByNumber, { number, title: '' });
      }
      continue;
    }
    unresolvedShas.push(commit.sha);
  }

  for (const sha of unresolvedShas) {
    const pulls = await ghApiJson(`repos/${repository}/commits/${sha}/pulls`);
    if (!Array.isArray(pulls)) {
      continue;
    }
    for (const pull of pulls) {
      const number = Number.parseInt(String(pull?.number ?? ''), 10);
      if (!Number.isInteger(number) || number <= 0) {
        continue;
      }
      mergePullRecord(pullsByNumber, {
        number,
        title: String(pull?.title ?? '')
      });
    }
  }

  for (const pull of pullsByNumber.values()) {
    if (pull.title.length > 0) {
      continue;
    }
    const details = await ghApiJson(`repos/${repository}/pulls/${pull.number}`);
    pull.title = String(details?.title ?? '');
  }

  return [...pullsByNumber.values()].sort((left, right) => left.number - right.number);
}

export function parsePullRequestReferences(value) {
  const ids = new Set();
  for (const match of value.matchAll(PR_HASH_REFERENCE_PATTERN)) {
    const number = Number.parseInt(match[1] ?? '', 10);
    if (Number.isInteger(number) && number > 0) {
      ids.add(number);
    }
  }
  for (const match of value.matchAll(PR_LINK_REFERENCE_PATTERN)) {
    const number = Number.parseInt(match[1] ?? '', 10);
    if (Number.isInteger(number) && number > 0) {
      ids.add(number);
    }
  }
  return ids;
}

export function formatPullRequestSection(pulls) {
  const sorted = [...pulls].sort((left, right) => left.number - right.number);
  const lines = ['## Merged pull requests', ''];
  if (sorted.length === 0) {
    lines.push('- _No pull requests detected._');
  } else {
    for (const pull of sorted) {
      lines.push(`- ${formatPullRequestLabel(pull)}`);
    }
  }
  return `${lines.join('\n')}\n`;
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

async function loadCommitsBetweenTags(repository, previousTag, latestTag) {
  const compare = await ghApiJson(
    `repos/${repository}/compare/${encodeURIComponent(previousTag)}...${encodeURIComponent(latestTag)}`
  );
  if (compare?.too_large) {
    throw new Error(
      `[release-audit] compare payload too large for ${previousTag}...${latestTag}; cut a smaller release interval`
    );
  }
  const commits = Array.isArray(compare?.commits) ? compare.commits : [];
  return commits.map((commit) => ({
    sha: String(commit?.sha ?? ''),
    message: String(commit?.commit?.message ?? '')
  }));
}

async function loadCommitsThroughTag(repository, latestTag) {
  const tagCommitSha = await resolveTagCommitSha(repository, latestTag);
  const commits = [];

  for (let page = 1; page <= MAX_BOOTSTRAP_COMMIT_PAGES; page += 1) {
    const batch = await ghApiJson(
      `repos/${repository}/commits?sha=${encodeURIComponent(tagCommitSha)}&per_page=100&page=${page}`
    );
    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }

    for (const commit of batch) {
      commits.push({
        sha: String(commit?.sha ?? ''),
        message: String(commit?.commit?.message ?? '')
      });
    }

    if (batch.length < 100) {
      break;
    }
  }

  return commits;
}

async function resolveTagCommitSha(repository, tag) {
  const ref = await ghApiJson(`repos/${repository}/git/ref/tags/${encodeURIComponent(tag)}`);
  const refType = String(ref?.object?.type ?? '');
  const refSha = String(ref?.object?.sha ?? '');

  if (refType === 'commit' && refSha.length > 0) {
    return refSha;
  }

  if (refType === 'tag' && refSha.length > 0) {
    const tagObject = await ghApiJson(`repos/${repository}/git/tags/${refSha}`);
    const tagType = String(tagObject?.object?.type ?? '');
    const tagSha = String(tagObject?.object?.sha ?? '');
    if (tagType === 'commit' && tagSha.length > 0) {
      return tagSha;
    }
  }

  throw new Error(`[release-audit] unable to resolve commit for tag ${tag}`);
}

function mergePullRecord(pullsByNumber, pull) {
  const existing = pullsByNumber.get(pull.number);
  if (!existing) {
    pullsByNumber.set(pull.number, {
      number: pull.number,
      title: normalizePullTitle(pull.title)
    });
    return;
  }

  if (existing.title.length === 0 && typeof pull.title === 'string' && pull.title.length > 0) {
    existing.title = normalizePullTitle(pull.title);
  }
}

function formatPullRequestLabel(pull) {
  const title = escapeMarkdownLabel(normalizePullTitle(pull.title) || `Pull request ${pull.number}`);
  return `[${title}] (#${pull.number})`;
}

function normalizePullTitle(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function escapeMarkdownLabel(value) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}
