import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DirArchiverError, audit, extract, write } from "../dist/index.js";

function makeSource(root) {
  const source = path.join(root, "payload");
  mkdirSync(source, { recursive: true });
  writeFileSync(path.join(source, "data.txt"), "This fixture is longer than sixteen bytes.\n");
  return source;
}

export async function run() {
  const root = mkdtempSync(path.join(tmpdir(), "dir-archiver-untrusted-"));
  try {
    const source = makeSource(root);
    const archivePath = path.join(root, "input.zip");
    await write(source, archivePath, { includeBaseDirectory: false, format: "zip" });

    const report = await audit(archivePath, { safetyProfile: "untrusted" });
    if (!report.isSafe) {
      throw new Error("Expected audit to pass for fixture archive.");
    }

    let limitFailureCode = null;
    try {
      await extract(archivePath, path.join(root, "out"), {
        safetyProfile: "strict",
        maxTotalExtractedBytes: 16,
      });
    } catch (error) {
      if (!(error instanceof DirArchiverError)) {
        throw error;
      }
      limitFailureCode = error.code;
    }

    const payload = {
      isSafe: report.isSafe,
      limitFailureCode,
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
