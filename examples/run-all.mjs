/**
 * Goal: Execute all `dir-archiver` examples and assert stable output contracts.
 * Prereqs:
 * - Run from repo root after `npm run build`.
 * Run:
 * - `node examples/run-all.mjs`
 * Expected output:
 * - Final line `examples:run dir-archiver PASS` and process exit code `0`.
 * Safety notes:
 * - Offline harness; does not contact external services.
 */
import assert from "node:assert/strict";
import { run as runBundle } from "./bundle-a-plugin.mjs";
import { run as runCiArtifact } from "./ci-release-artifact.mjs";
import { run as runExtractUntrusted } from "./extract-untrusted.mjs";

const bundle = await runBundle();
assert.equal(bundle.ok, true);
assert.equal(bundle.outputExists, true);
assert.equal(bundle.format, "zip");

const ciSummary = await runCiArtifact();
assert.equal(ciSummary.ok, true);
assert.equal(ciSummary.format, "zip");
assert.equal(typeof ciSummary.entryCount, "number");

const untrusted = await runExtractUntrusted();
assert.equal(untrusted.ok, true);
assert.equal(untrusted.auditOk, true);
assert.equal(untrusted.expectedLimitFailureCode, "DIRARCHIVER_RESOURCE_LIMIT");

console.log("examples:run dir-archiver PASS");
