import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_DIRS = ['src'];
const ROOT_SOURCE_FILES = ['index.ts', 'mod.ts'];
const CJS_PATTERN = /\brequire\s*\(|module\.exports|\bexports\./g;

const run = async () => {
  const targets = [];

  for (const directory of SOURCE_DIRS) {
    const absoluteDirectory = path.join(ROOT, directory);
    await collectFiles(absoluteDirectory, targets);
  }

  for (const fileName of ROOT_SOURCE_FILES) {
    const absolutePath = path.join(ROOT, fileName);
    try {
      const content = await readFile(absolutePath, 'utf8');
      targets.push({ path: absolutePath, content });
    } catch {
      // Ignore absent optional root entrypoints.
    }
  }

  const violations = [];
  for (const file of targets) {
    const lines = file.content.split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? '';
      if (!CJS_PATTERN.test(line)) {
        continue;
      }
      CJS_PATTERN.lastIndex = 0;
      const rel = path.relative(ROOT, file.path).replace(/\\/g, '/');
      violations.push(`${rel}:${index + 1}: ${line.trim()}`);
    }
  }

  if (violations.length > 0) {
    console.error('[esm-only-guard] CommonJS tokens are forbidden in source entrypoints:');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exitCode = 1;
  }
};

async function collectFiles(directoryPath, targets) {
  let entries;
  try {
    entries = await readdir(directoryPath, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(entryPath, targets);
      continue;
    }
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.mts')) {
      continue;
    }
    const content = await readFile(entryPath, 'utf8');
    targets.push({ path: entryPath, content });
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
