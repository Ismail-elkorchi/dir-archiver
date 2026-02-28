import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { extract, list, write } from '../dist/index.js';

const args = parseArgs(process.argv.slice(2));
const outPath = args.out;

const run = async () => {
  if (!outPath) {
    throw new Error('runtime-fingerprint requires --out <path>');
  }

  const format = args.format ?? 'zip';
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'dir-archiver-fingerprint-'));

  try {
    const sourceDir = path.join(tmpRoot, 'source');
    mkdirSync(path.join(sourceDir, 'nested'), { recursive: true });
    writeFileSync(path.join(sourceDir, 'root.txt'), 'root-content');
    writeFileSync(path.join(sourceDir, 'nested', 'nested.txt'), 'nested-content');

    const archivePath = path.join(tmpRoot, `bundle.${format.replace('/', '.')}`);
    await write(sourceDir, archivePath, { format, includeBaseDirectory: true });
    const listed = await list(archivePath, {});

    const extractDir = path.join(tmpRoot, 'extracted');
    await extract(archivePath, extractDir, { profile: 'strict' });

    const entryDescriptors = listed.entries
      .map((entry) => `${entry.name}:${entry.size}:${entry.isDirectory ? 'd' : 'f'}`)
      .sort();
    const extractedDescriptors = collectExtractedDescriptors(extractDir).sort();

    const fingerprintInput = JSON.stringify({
      format: listed.format,
      entries: entryDescriptors,
      extracted: extractedDescriptors
    });
    const fingerprint = createHash('sha256').update(fingerprintInput).digest('hex');

    writeFileSync(
      outPath,
      `${JSON.stringify(
        {
          format,
          detectedFormat: listed.format,
          fingerprint,
          entries: entryDescriptors,
          extracted: extractedDescriptors
        },
        null,
        2
      )}\n`
    );
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
};

function collectExtractedDescriptors(rootDir) {
  const descriptors = [];
  visit(rootDir, '');
  return descriptors;

  function visit(currentPath, relativePrefix) {
    const entries = readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = relativePrefix.length > 0 ? path.join(relativePrefix, entry.name) : entry.name;
      if (entry.isDirectory()) {
        visit(absolutePath, relativePath);
        continue;
      }
      const bytes = readFileSync(absolutePath);
      const digest = createHash('sha256').update(bytes).digest('hex');
      descriptors.push(`${relativePath.replace(/\\/g, '/')}:${digest}`);
    }
  }
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--out') {
      options.out = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === '--format') {
      options.format = argv[index + 1];
      index += 1;
    }
  }
  return options;
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
