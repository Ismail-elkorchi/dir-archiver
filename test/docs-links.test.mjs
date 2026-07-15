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
  '.github'
];

const canonicalConsumerDocs = new Set([
  'docs/index.md',
  'docs/getting-started.md',
  'docs/api.md',
  'docs/cli.md',
  'docs/safety.md',
  'docs/formats.md',
  'docs/troubleshooting.md'
]);

const legacyMovedPages = new Map([
  ['docs/tutorial/first-archive-flow.md', '../getting-started.md'],
  ['docs/tutorial/bundle-a-plugin.md', '../api.md#write'],
  ['docs/how-to/index.md', '../index.md'],
  ['docs/how-to/cli-json-and-exit-codes.md', '../cli.md#automation-contract'],
  ['docs/how-to/extract-untrusted.md', '../safety.md#recommended-extraction-flow'],
  ['docs/how-to/troubleshoot-common-failures.md', '../troubleshooting.md'],
  ['docs/reference/index.md', '../index.md'],
  ['docs/reference/cli.md', '../cli.md'],
  ['docs/reference/options.md', '../api.md'],
  ['docs/reference/contract.md', '../../CONTRACT.md'],
  ['docs/explanation/index.md', '../index.md'],
  ['docs/explanation/profiles.md', '../safety.md#profiles']
]);

const packageManifest = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
);
const jsrManifest = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'jsr.json'), 'utf8')
);

const publicationEntries = new Map([
  ['npm', ['package.json', ...packageManifest.files]],
  ['JSR', jsrManifest.publish.include]
]);

const walk = (directory) => {
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
};

const collectMarkdownFiles = () => {
  const files = rootMarkdownFiles.map((relativePath) => path.join(repoRoot, relativePath));

  for (const relativeDirectory of markdownDirectories) {
    const directory = path.join(repoRoot, relativeDirectory);
    if (!fs.existsSync(directory)) {
      continue;
    }
    files.push(...walk(directory).filter((filePath) => path.extname(filePath).toLowerCase() === '.md'));
  }

  return [...new Set(files)].sort();
};

const normalizeMarkdownTarget = (raw) => {
  if (raw.startsWith('<') && raw.endsWith('>')) {
    return raw.slice(1, -1);
  }

  const titleMatch = raw.match(/^(\S+)(?:\s+["'][^"']*["'])$/u);
  return titleMatch?.[1] ?? raw;
};

const isExternalTarget = (target) => /^(?:https?:|mailto:|tel:|data:|javascript:)/iu.test(target);

const collectLinks = (source, includeExternal = false) => {
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
    if (fence) {
      continue;
    }

    const expression = /!?\[[^\]]*\]\(([^)]+)\)/gu;
    for (const match of line.matchAll(expression)) {
      const raw = (match[1] ?? '').trim();
      const target = normalizeMarkdownTarget(raw);
      if (!target || (!includeExternal && isExternalTarget(target))) {
        continue;
      }
      links.push({ target, line: index + 1 });
    }
  }

  return links;
};

const resolveLink = (sourcePath, target) => {
  const hashIndex = target.indexOf('#');
  const rawPath = hashIndex === -1 ? target : target.slice(0, hashIndex);
  const rawFragment = hashIndex === -1 ? '' : target.slice(hashIndex + 1);
  const withoutQuery = rawPath.split('?')[0] ?? '';

  try {
    const decodedPath = decodeURIComponent(withoutQuery);
    const filePath = decodedPath.length === 0
      ? sourcePath
      : decodedPath.startsWith('/')
        ? path.join(repoRoot, decodedPath.slice(1))
        : path.resolve(path.dirname(sourcePath), decodedPath);

    return {
      filePath,
      fragment: decodeURIComponent(rawFragment).toLowerCase()
    };
  } catch {
    return undefined;
  }
};

const githubHeadingSlug = (value) => value
  .replace(/!\[([^\]]*)\]\([^)]*\)/gu, '$1')
  .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
  .replace(/[`*_~]/gu, '')
  .trim()
  .toLowerCase()
  .replace(/[^\p{L}\p{N}_\-\s]/gu, '')
  .replace(/\s+/gu, '-');

const collectHeadingAnchors = (source) => {
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
    if (fence) {
      continue;
    }

    const headingMatch = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/u);
    if (!headingMatch) {
      continue;
    }

    const base = githubHeadingSlug(headingMatch[1] ?? '');
    if (!base) {
      continue;
    }
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }

  return anchors;
};

const relative = (filePath) => path.relative(repoRoot, filePath).replaceAll(path.sep, '/');

const isInsideRepository = (filePath) => {
  const relativePath = path.relative(repoRoot, filePath);
  return relativePath === ''
    || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
};

const manifestIncludesPath = (relativePath, entries) => {
  const normalizedPath = relativePath.replace(/\\/gu, '/');

  for (const rawEntry of entries) {
    const entry = rawEntry.replace(/\\/gu, '/');
    if (entry.endsWith('/**')) {
      const prefix = entry.slice(0, -3);
      if (normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)) {
        return true;
      }
      continue;
    }

    if (normalizedPath === entry || normalizedPath.startsWith(`${entry}/`)) {
      return true;
    }
  }

  return false;
};

test('relative Markdown links and heading anchors resolve', () => {
  const failures = [];

  for (const sourcePath of collectMarkdownFiles()) {
    const source = fs.readFileSync(sourcePath, 'utf8');
    for (const link of collectLinks(source)) {
      const resolved = resolveLink(sourcePath, link.target);
      if (!resolved) {
        failures.push(`${relative(sourcePath)}:${link.line} -> invalid ${link.target}`);
        continue;
      }

      if (!isInsideRepository(resolved.filePath)) {
        failures.push(`${relative(sourcePath)}:${link.line} -> ${link.target} escapes the repository`);
        continue;
      }

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

for (const [label, entries] of publicationEntries) {
  test(`${label} Markdown links stay inside the published package`, () => {
    const failures = [];

    for (const sourcePath of collectMarkdownFiles()) {
      const sourceRelative = relative(sourcePath);
      if (!manifestIncludesPath(sourceRelative, entries)) {
        continue;
      }

      const source = fs.readFileSync(sourcePath, 'utf8');
      for (const link of collectLinks(source)) {
        const resolved = resolveLink(sourcePath, link.target);
        if (!resolved || !isInsideRepository(resolved.filePath)) {
          continue;
        }

        const targetRelative = relative(resolved.filePath);
        if (!manifestIncludesPath(targetRelative, entries)) {
          failures.push(
            `${sourceRelative}:${link.line} -> ${link.target} targets unpublished ${targetRelative}`
          );
        }
      }
    }

    assert.deepEqual(failures, []);
  });
}

test('canonical consumer pages are present and published', () => {
  for (const requiredPath of canonicalConsumerDocs) {
    assert.equal(fs.existsSync(path.join(repoRoot, requiredPath)), true, `missing ${requiredPath}`);
    for (const [label, entries] of publicationEntries) {
      assert.equal(
        manifestIncludesPath(requiredPath, entries),
        true,
        `${requiredPath} must be included in the ${label} package`
      );
    }
  }
});

test('consumer documentation stays on canonical pages', () => {
  const docsMarkdown = walk(path.join(repoRoot, 'docs'))
    .filter((filePath) => path.extname(filePath).toLowerCase() === '.md')
    .map(relative)
    .sort();
  const allowedDocs = new Set([
    ...canonicalConsumerDocs,
    ...legacyMovedPages.keys()
  ]);
  const unexpected = docsMarkdown.filter((relativePath) => !allowedDocs.has(relativePath));

  assert.deepEqual(
    unexpected,
    [],
    'consumer material must stay on canonical pages; old paths may only be move notices'
  );
});

test('legacy documentation paths remain repository-only move notices', () => {
  for (const [relativePath, target] of legacyMovedPages) {
    const filePath = path.join(repoRoot, relativePath);
    assert.equal(fs.existsSync(filePath), true, `missing ${relativePath}`);

    const source = fs.readFileSync(filePath, 'utf8');
    const links = collectLinks(source, true);

    assert.match(source, /compatibility page is retained/iu, `${relativePath} needs a move notice`);
    assert.equal(links.length, 1, `${relativePath} must contain exactly one link`);
    assert.equal(links[0]?.target, target, `${relativePath} must point to ${target}`);
    assert.equal(source.includes('```'), false, `${relativePath} must not duplicate examples`);
    assert.ok(source.length < 500, `${relativePath} must stay minimal`);

    for (const [label, entries] of publicationEntries) {
      assert.equal(
        manifestIncludesPath(relativePath, entries),
        false,
        `${relativePath} must stay out of the ${label} package`
      );
    }
  }
});
