import { readFile } from 'node:fs/promises';
import path from 'node:path';

const run = async () => {
  const ROOT = process.cwd();
  const policyPath = path.join(ROOT, 'tools', 'runtime-versions.json');
  const policy = JSON.parse(await readFile(policyPath, 'utf8'));

  const runtimeConfigs = [
    { runtime: 'node', latest: latestNodeLts },
    { runtime: 'deno', latest: latestDenoStable },
    { runtime: 'bun', latest: latestBunStable }
  ];

  const messages = [];
  const violations = [];

  for (const target of runtimeConfigs) {
    const config = policy[target.runtime];
    if (!config || typeof config.pinned !== 'string') continue;

    const pinned = parseSemver(config.pinned);
    const floor = parseSemver(config.floor);
    const latest = await target.latest();
    const tolerance = policy.policy?.staleness?.[target.runtime] ?? {};
    const maxMajorLag = Number.isInteger(tolerance.maxMajorLag) ? tolerance.maxMajorLag : 0;
    const maxMinorLag = Number.isInteger(tolerance.maxMinorLag) ? tolerance.maxMinorLag : 0;

    if (!pinned || !latest) {
      violations.push(`${target.runtime}: invalid pinned or latest version`);
      continue;
    }

    messages.push(`${target.runtime}: floor=${floor ? floor.raw : 'n/a'} pinned=${pinned.raw} latest=${latest.raw}`);

    const majorLag = latest.major - pinned.major;
    const minorLag = latest.major === pinned.major ? latest.minor - pinned.minor : 0;
    if (majorLag > maxMajorLag) {
      violations.push(`${target.runtime}: major lag ${majorLag} exceeds policy ${maxMajorLag}`);
      continue;
    }
    if (majorLag === 0 && minorLag > maxMinorLag) {
      violations.push(`${target.runtime}: minor lag ${minorLag} exceeds policy ${maxMinorLag}`);
    }
  }

  for (const message of messages) {
    process.stdout.write(`${message}\n`);
  }

  if (violations.length > 0) {
    process.stderr.write('[runtime-staleness] policy violations detected:\n');
    for (const violation of violations) {
      process.stderr.write(`- ${violation}\n`);
    }
    process.exitCode = 1;
  }
};

async function latestNodeLts() {
  const response = await fetch('https://nodejs.org/dist/index.json');
  if (!response.ok) throw new Error(`node index fetch failed: ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload)) return null;
  for (const item of payload) {
    if (!item || typeof item !== 'object') continue;
    if (!item.lts) continue;
    const version = parseSemver(item.version);
    if (version) return version;
  }
  return null;
}

async function latestDenoStable() {
  return latestGitHubTag('denoland', 'deno');
}

async function latestBunStable() {
  return latestGitHubTag('oven-sh', 'bun');
}

async function latestGitHubTag(owner, repo) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
    headers: {
      'User-Agent': 'runtime-staleness-check'
    }
  });
  if (!response.ok) throw new Error(`${owner}/${repo} latest release fetch failed: ${response.status}`);
  const payload = await response.json();
  const tag = typeof payload.tag_name === 'string' ? payload.tag_name : '';
  return parseSemver(tag);
}

function parseSemver(value) {
  const match = String(value).trim().match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;
  const major = match[1] ?? '0';
  const minor = match[2] ?? '0';
  const patch = match[3] ?? '0';
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    raw: `${major}.${minor}.${patch}`
  };
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
