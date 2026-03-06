import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const POLICY_PATH = path.join(ROOT, 'tools', 'jsr-docs-policy.json');

const run = async () => {
  const policy = JSON.parse(await readFile(POLICY_PATH, 'utf8'));
  const sourceFile = String(policy.sourceFile ?? 'src/index.ts');
  const requiredDocs = Array.isArray(policy.requiredDocs) ? policy.requiredDocs : [];

  const { stdout } = await execFileAsync(
    'deno',
    ['doc', '--json', '--sloppy-imports', sourceFile],
    {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024
    }
  );

  const documentTree = JSON.parse(stdout);
  const docsByPath = collectDocs(Array.isArray(documentTree?.nodes) ? documentTree.nodes : []);
  const failures = [];

  for (const symbolPath of requiredDocs) {
    if (!docsByPath.has(symbolPath)) {
      failures.push(`missing symbol in deno doc output: ${symbolPath}`);
      continue;
    }
    if ((docsByPath.get(symbolPath) ?? '').length === 0) {
      failures.push(`missing JSDoc body for ${symbolPath}`);
    }
  }

  process.stdout.write(
    `jsr-docs-quality: source=${sourceFile} checked=${requiredDocs.length} failures=${failures.length}\n`
  );

  if (failures.length > 0) {
    throw new Error(failures.join('\n'));
  }
};

function collectDocs(nodes) {
  const docsByPath = new Map();
  for (const node of nodes) {
    const rootName = node?.isDefault === true ? 'default' : String(node?.name ?? '');
    if (rootName.length === 0) {
      continue;
    }
    collectNodeDocs(rootName, node, docsByPath);
  }
  return docsByPath;
}

function collectNodeDocs(pathPrefix, node, docsByPath) {
  docsByPath.set(pathPrefix, normalizeDoc(node?.jsDoc));

  if (node?.kind === 'class') {
    collectMembers(pathPrefix, node.classDef?.properties, docsByPath);
    collectMembers(pathPrefix, node.classDef?.methods, docsByPath);
    return;
  }

  if (node?.kind === 'interface') {
    collectMembers(pathPrefix, node.interfaceDef?.properties, docsByPath);
    collectMembers(pathPrefix, node.interfaceDef?.methods, docsByPath);
  }
}

function collectMembers(pathPrefix, members, docsByPath) {
  if (!Array.isArray(members)) {
    return;
  }
  for (const member of members) {
    const name = String(member?.name ?? '');
    if (name.length === 0) {
      continue;
    }
    docsByPath.set(`${pathPrefix}.${name}`, normalizeDoc(member?.jsDoc));
  }
}

function normalizeDoc(jsDoc) {
  if (typeof jsDoc?.doc !== 'string') {
    return '';
  }
  return jsDoc.doc.replace(/\s+/g, ' ').trim();
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
