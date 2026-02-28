import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const PACKAGE_SCOPE = 'ismail-elkorchi';
const PACKAGE_NAME = 'dir-archiver';
const SCORE_URL = `https://api.jsr.io/scopes/${PACKAGE_SCOPE}/packages/${PACKAGE_NAME}/score`;

const run = async () => {
  const policy = JSON.parse(await readFile(path.join(ROOT, 'tools', 'docs-policy.json'), 'utf8'));
  const response = await fetch(SCORE_URL);
  if (!response.ok) {
    throw new Error(`JSR score API request failed: ${response.status}`);
  }
  const payload = await response.json();

  const requiredBooleans = [
    'hasDescription',
    'hasReadme',
    'hasReadmeExamples',
    'allEntrypointsDocs',
    'allFastCheck',
    'hasProvenance',
    'atLeastOneRuntimeCompatible',
    'multipleRuntimesCompatible'
  ];
  for (const field of requiredBooleans) {
    if (payload[field] !== true) {
      throw new Error(`JSR score boolean failed: ${field}=false`);
    }
  }

  const minDocumentedSymbols = Number(policy.minDocumentedSymbols ?? 0);
  const percentageDocumentedSymbols = Number(payload.percentageDocumentedSymbols ?? 0);
  if (percentageDocumentedSymbols < minDocumentedSymbols) {
    throw new Error(
      `JSR documented symbol ratio ${percentageDocumentedSymbols} is below policy ${minDocumentedSymbols}`
    );
  }

  const targetTotal = Number(policy.targetTotal ?? 0);
  const total = Number(payload.total ?? 0);
  if (total < targetTotal) {
    throw new Error(`JSR total ${total} is below policy target ${targetTotal}`);
  }

  process.stdout.write(
    `jsr-score-gate: total=${total} documented=${percentageDocumentedSymbols} target=${targetTotal}\n`
  );
};

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
