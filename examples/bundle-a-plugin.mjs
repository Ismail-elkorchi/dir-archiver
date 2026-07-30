import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { detect, write } from "../dist/index.js";

function makeFixture(root) {
  const pluginDir = path.join(root, "plugin");
  mkdirSync(pluginDir, { recursive: true });
  mkdirSync(path.join(pluginDir, ".git"), { recursive: true });
  mkdirSync(path.join(pluginDir, "node_modules"), { recursive: true });
  writeFileSync(path.join(pluginDir, "index.js"), "export const plugin = true;\n");
  writeFileSync(path.join(pluginDir, "README.md"), "# Plugin fixture\n");
  writeFileSync(path.join(pluginDir, "package.json"), '{"name":"plugin-fixture"}\n');
  writeFileSync(path.join(pluginDir, "package-lock.json"), "{}\n");
  writeFileSync(path.join(pluginDir, ".git", "HEAD"), "ref: refs/heads/main\n");
  writeFileSync(path.join(pluginDir, "node_modules", "skip.txt"), "skip\n");
  return pluginDir;
}

export async function run() {
  const root = mkdtempSync(path.join(tmpdir(), "dir-archiver-bundle-"));
  try {
    const pluginDir = makeFixture(root);
    const archivePath = path.join(root, "bundle.zip");
    const result = await write(pluginDir, archivePath, {
      includeBaseDirectory: true,
      exclude: [".git", "node_modules", "package-lock.json", "package.json"],
    });
    const detected = await detect(archivePath);
    const payload = {
      archivePath,
      format: detected.format,
      entryCount: result.entryCount,
    };
    console.log(JSON.stringify(payload, null, 2));
    return payload;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

if (
  process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await run();
}
