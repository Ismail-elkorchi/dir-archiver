import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

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
  const docsByPath = collectDocs(documentTree, sourceFile);
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

function collectDocs(nodes, sourceFile) {
  const docsByPath = new Map();
  const normalizedNodes = normalizeNodes(nodes, sourceFile);
  for (const node of normalizedNodes) {
    const rootName = node?.isDefault === true ? 'default' : String(node?.name ?? '');
    if (rootName.length === 0) {
      continue;
    }
    collectNodeDocs(rootName, node, docsByPath);
  }
  return docsByPath;
}

function collectNodeDocs(pathPrefix, node, docsByPath) {
  const declarations = Array.isArray(node?.declarations) ? node.declarations : [];

  if (declarations.length === 1) {
    collectDeclarationDocs(pathPrefix, declarations[0], docsByPath);
    return;
  }

  if (declarations.length > 1) {
    for (let index = 0; index < declarations.length; index += 1) {
      collectDeclarationDocs(`${pathPrefix}#${index}`, declarations[index], docsByPath);
    }
    return;
  }

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

  if (node?.kind === 'enum') {
    collectMembers(pathPrefix, node.enumDef?.members, docsByPath);
  }
}

function collectDeclarationDocs(pathPrefix, declaration, docsByPath) {
  if (!declaration || typeof declaration !== 'object') {
    return;
  }

  docsByPath.set(pathPrefix, normalizeDoc(declaration.jsDoc));
  const def = declaration.def;
  if (!def || typeof def !== 'object') {
    return;
  }

  collectMembers(pathPrefix, def.properties, docsByPath);
  collectMembers(pathPrefix, def.methods, docsByPath);
  collectMembers(pathPrefix, def.interfaceDef?.properties, docsByPath);
  collectMembers(pathPrefix, def.interfaceDef?.methods, docsByPath);
  collectMembers(pathPrefix, def.classDef?.properties, docsByPath);
  collectMembers(pathPrefix, def.classDef?.methods, docsByPath);
  if (declaration.kind === 'enum' || def.kind === 'enum') {
    collectMembers(pathPrefix, def.members, docsByPath);
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

function normalizeNodes(documentTree, sourceFile = 'src/index.ts') {
  if (!documentTree) {
    return [];
  }
  if (Array.isArray(documentTree)) {
    return documentTree;
  }
  if (documentTree.nodes && typeof documentTree.nodes === 'object' && !Array.isArray(documentTree.nodes)) {
    const sourceUrl = getSourceFileUrl(documentTree.nodes, sourceFile);
    if (sourceUrl !== '') {
      const moduleNode = documentTree.nodes[sourceUrl];
      if (moduleNode) {
        return moduleNode.symbols ?? [];
      }
    }

    const fallback = Object.values(documentTree.nodes).find((value) => Array.isArray(value?.symbols));
    if (fallback && Array.isArray(fallback.symbols)) {
      return fallback.symbols;
    }
  }
  return [];
}

function getSourceFileUrl(nodesMap, sourceFile) {
  const candidate = path.resolve(process.cwd(), sourceFile);
  const preferred = pathToFileURL(candidate).href;
  if (nodesMap[preferred]) {
    return preferred;
  }
  const fallback = path.resolve(process.cwd(), String(sourceFile));
  const fallbackUrl = pathToFileURL(fallback).href;
  if (nodesMap[fallbackUrl]) {
    return fallbackUrl;
  }
  return '';
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
