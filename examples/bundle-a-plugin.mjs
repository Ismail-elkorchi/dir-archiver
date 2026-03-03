/**
 * Goal: Bundle a plugin directory into a ZIP while excluding development artifacts.
 * Prereqs:
 * - Run from repo root after `npm run build`.
 * Run:
 * - `node examples/bundle-a-plugin.mjs`
 * Expected output:
 * - JSON object with `{ ok: true, format: "zip", entryCount, wrappedDirectoryCodec }`.
 * Safety notes:
 * - Uses a temporary directory and deletes it before exit.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
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
    const output = path.join(root, "bundle.zip");
    const result = await write(pluginDir, output, {
      includeBaseDirectory: true,
      exclude: [".git", "node_modules", "package-lock.json", "package.json"],
    });
    const detected = await detect(output);
    const payload = {
      ok: true,
      output,
      outputExists: existsSync(output),
      format: detected.format,
      entryCount: result.entryCount,
      wrappedDirectoryCodec: result.wrappedDirectoryCodec,
    };
    console.log(JSON.stringify(payload, null, 2));
    return payload;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await run();
}
