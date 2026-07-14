import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '..');

const rootMarkdownFiles = [
  'README.md',
  'CHANGELOG.md',
  'CONTRACT.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'SUPPORT.md'
];

const markdownDirectories = [
  'docs',
  'maintenance',
  '.github'
];

const canonicalConsumerDocs = [
  'docs/index.md',
  'docs/getting-started.md',
  'docs/api.md',
  'docs/cli.md',
  'docs/safety.md',
  'docs/formats.md',
  'docs/troubleshooting.md'
];

test('local Markdown links and heading anchors resolve', () => {
  const markdownFiles = collectMarkdownFiles();
  const failures = [];

  for (const sourcePath of markdownFiles) {
    const source = fs.readFileSync(sourcePath, 'utf8');
    for (const link of collectLocalLinks(source)) {
      const resolved = resolveLink(sourcePath, link.target);
      if (!resolved) continue;

      if (!fs.existsSync(resolved.filePath)) {
        failures.push(`${relative(sourcePath)}:${link.line} -> missing ${relative(resolved.filePath)}`);
        continue;
      }

      if (!resolved.fragment || path.extname(resolved.filePath).toLowerCase() !== '.md') {
        continue;
      }

      const anchors = collectHeadingAnchors(fs.readFileSync(resolved.filePath, 'utf8'));
      if (!anchors.has(resolved.fragment)) {
        failures.push(
          `${relative(sourcePath)}:${link.line} -> missing #${resolved.fragment} in ${relative(resolved.filePath)}`
        );
      }
    }
  }

  assert.deepEqual(failures, []);
});

test('consumer documentation stays on the canonical pages', () => {
  for (const relativePath of canonicalConsumerDocs) {
    assert.equal(fs.existsSync(path.join(repoRoot, relativePath)), true, `missing ${relativePath}`);
  }

  const recipesPath = path.join(repoRoot, 'docs', 'recipes');
  const recipeMarkdown = fs.existsSync(recipesPath)
    ? walk(recipesPath).filter((filePath) => path.extname(filePath).toLowerCase() === '.md')
    : [];

  assert.deepEqual(
    recipeMarkdown.map(relative),
    [],
    'consumer tasks should be added to canonical pages instead of a duplicated recipes layer'
  );
});

function collectMarkdownFiles() {
  const files = rootMarkdownFiles.map((relativePath) => path.join(repoRoot, relativePath));

  for (const relativeDirectory of markdownDirectories) {
    const directory = path.join(repoRoot, relativeDirectory);
    if (!fs.existsSync(directory)) continue;
    files.push(...walk(directory).filter((filePath) => path.extname(filePath).toLowerCase() === '.md'));
  }

  return [...new Set(files)].sort();
}

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

function collectLocalLinks(source) {
  const links = [];
  const lines = source.replace(/\r\n/gu, '\n').split('\n');
  let fence = undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/u);
    if (fenceMatch) {
      const marker = fenceMatch[1]?.[0];
      if (!fence) {
        fence = marker;
      } else if (fence === marker) {
        fence = undefined;
      }
      continue;
    }
    if (fence) continue;

    const expression = /!?\[[^\]]*\]\(([^)]+)\)/gu;
    for (const match of line.matchAll(expression)) {
      const raw = (match[1] ?? '').trim();
      const target = normalizeMarkdownTarget(raw);
      if (!target || isExternalTarget(target)) continue;
      links.push({ target, line: index + 1 });
    }
  }

  return links;
}

function normalizeMarkdownTarget(raw) {
  if (raw.startsWith('<') && raw.endsWith('>')) {
    return raw.slice(1, -1);
  }

  const titleMatch = raw.match(/^(\S+)(?:\s+["'][^"']*["'])$/u);
  return titleMatch?.[1] ?? raw;
}

function isExternalTarget(target) {
  return /^(?:https?:|mailto:|tel:|data:|javascript:)/iu.test(target);
}

function resolveLink(sourcePath, target) {
  const hashIndex = target.indexOf('#');
  const rawPath = hashIndex === -1 ? target : target.slice(0, hashIndex);
  const rawFragment = hashIndex === -1 ? '' : target.slice(hashIndex + 1);
  const withoutQuery = rawPath.split('?')[0] ?? '';

  let decodedPath;
  let decodedFragment;
  try {
    decodedPath = decodeURIComponent(withoutQuery);
    decodedFragment = decodeURIComponent(rawFragment).toLowerCase();
  } catch {
    return undefined;
  }

  const filePath = decodedPath.length === 0
    ? sourcePath
    : decodedPath.startsWith('/')
      ? path.join(repoRoot, decodedPath.slice(1))
      : path.resolve(path.dirname(sourcePath), decodedPath);

  return {
    filePath,
    fragment: decodedFragment
  };
}

function collectHeadingAnchors(source) {
  const anchors = new Set();
  const counts = new Map();
  const lines = source.replace(/\r\n/gu, '\n').split('\n');
  let fence = undefined;

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/u);
    if (fenceMatch) {
      const marker = fenceMatch[1]?.[0];
      if (!fence) {
        fence = marker;
      } else if (fence === marker) {
        fence = undefined;
      }
      continue;
    }
    if (fence) continue;

    const headingMatch = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/u);
    if (!headingMatch) continue;

    const base = githubHeadingSlug(headingMatch[1] ?? '');
    if (!base) continue;
    const count = counts.get(base) ?? 0;
    const anchor = count === 0 ? base : `${base}-${count}`;
    counts.set(base, count + 1);
    anchors.add(anchor);
  }

  return anchors;
}

function githubHeadingSlug(value) {
  return value
    .replace(/<[^>]*>/gu, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replace(/[`*_~]/gu, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\-\s]/gu, '')
    .replace(/\s+/gu, '-');
}

function relative(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, '/');
}
