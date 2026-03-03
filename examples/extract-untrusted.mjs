/**
 * Goal: Demonstrate audit-first extraction and deterministic resource-limit failure.
 * Prereqs:
 * - Run from repo root after `npm run build`.
 * Run:
 * - `node examples/extract-untrusted.mjs`
 * Expected output:
 * - JSON object with `{ ok: true, auditOk: true, expectedLimitFailureCode: "DIRARCHIVER_RESOURCE_LIMIT" }`.
 * Safety notes:
 * - Uses temporary fixtures and strict extraction limits; no network access.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { audit, extract, write } from "../dist/index.js";

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

    const report = await audit(archivePath, { profile: "agent" });
    if (!report.ok) {
      throw new Error("Expected audit to pass for fixture archive.");
    }

    let limitFailureCode = null;
    try {
      await extract(archivePath, path.join(root, "out"), {
        profile: "strict",
        maxTotalExtractedBytes: 16,
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error) {
        limitFailureCode = String(error.code);
      } else {
        limitFailureCode = "UNKNOWN_ERROR";
      }
    }

    const payload = {
      ok: true,
      auditOk: report.ok,
      expectedLimitFailureCode: limitFailureCode,
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
