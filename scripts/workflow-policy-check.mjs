import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');
const mutableRefPattern = /uses:\s*[^#\n]+@(v\d+(?:\.\d+)*|main|master)\b/g;
const pullRequestTargetPattern = /(^|\n)\s*pull_request_target\s*:/m;
const topLevelPermissionsPattern = /^permissions:\s*$/m;

function readTopLevelPermissionsBlock(source) {
  const lines = source.split('\n');
  const startIndex = lines.findIndex((line) => line === 'permissions:');
  if (startIndex === -1) {
    return null;
  }
  const collected = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (line.length === 0) {
      if (collected.length > 0) {
        break;
      }
      continue;
    }
    if (!line.startsWith('  ')) {
      break;
    }
    collected.push(line);
  }
  return collected.join('\n');
}

const run = async () => {
  const workflowFiles = (await readdir(WORKFLOWS_DIR))
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .sort((left, right) => left.localeCompare(right));

  const violations = [];

  for (const fileName of workflowFiles) {
    const workflowPath = path.join(WORKFLOWS_DIR, fileName);
    const source = (await readFile(workflowPath, 'utf8')).replace(/\r\n/g, '\n');

    const mutableMatch = source.match(mutableRefPattern);
    if (mutableMatch) {
      violations.push(`${fileName}: mutable action ref(s): ${mutableMatch.join(', ')}`);
    }

    if (!topLevelPermissionsPattern.test(source)) {
      violations.push(`${fileName}: missing top-level permissions block`);
    }

    if (pullRequestTargetPattern.test(source)) {
      violations.push(`${fileName}: forbidden pull_request_target trigger`);
    }

    const permissionsBlock = readTopLevelPermissionsBlock(source);
    if (!permissionsBlock) {
      continue;
    }
    const writeLines = permissionsBlock
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.endsWith(': write'));
    if (writeLines.length > 0) {
      violations.push(`${fileName}: top-level permissions must stay read-only (found ${writeLines.join(', ')})`);
    }
  }

  if (violations.length > 0) {
    console.error('[workflow-policy] violations detected:');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
