/**
 * Goal: Produce a release artifact ZIP and print a machine-readable summary for CI.
 * Prereqs:
 * - Run from repo root after `npm run build`.
 * Run:
 * - `node examples/ci-release-artifact.mjs`
 * Expected output:
 * - JSON object with `{ ok: true, artifact, format, entryCount }`.
 * Safety notes:
 * - Uses temporary local files only; no network calls.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { detect, write } from "../dist/index.js";

function makeBuildOutput(root) {
  const buildDir = path.join(root, "build-output");
  mkdirSync(buildDir, { recursive: true });
  writeFileSync(path.join(buildDir, "index.js"), "console.log('release');\n");
  writeFileSync(path.join(buildDir, "manifest.json"), '{"version":"1.0.0"}\n');
  return buildDir;
}

export async function run() {
  const root = mkdtempSync(path.join(tmpdir(), "dir-archiver-ci-"));
  try {
    const source = makeBuildOutput(root);
    const artifact = path.join(root, "release-artifact.zip");
    const writeResult = await write(source, artifact, {
      includeBaseDirectory: true,
      format: "zip",
    });
    const detectResult = await detect(artifact);
    const summary = {
      ok: true,
      artifact,
      format: detectResult.format,
      entryCount: writeResult.entryCount,
      wrappedDirectoryCodec: writeResult.wrappedDirectoryCodec,
    };
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await run();
}
