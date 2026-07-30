import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
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
      artifact,
      format: detectResult.format,
      entryCount: writeResult.entryCount,
    };
    console.log(JSON.stringify(summary, null, 2));
    return summary;
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
