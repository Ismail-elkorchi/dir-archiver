import assert from "node:assert/strict";
import { run as runBundle } from "./bundle-a-plugin.mjs";
import { run as runCiArtifact } from "./ci-release-artifact.mjs";
import { run as runExtractUntrusted } from "./extract-untrusted.mjs";

const bundle = await runBundle();
assert.equal(bundle.format, "zip");

const ciSummary = await runCiArtifact();
assert.equal(ciSummary.format, "zip");
assert.equal(typeof ciSummary.entryCount, "number");

const untrusted = await runExtractUntrusted();
assert.equal(untrusted.isSafe, true);
assert.equal(untrusted.limitFailureCode, "DIRARCHIVER_RESOURCE_LIMIT");

console.log("examples:run dir-archiver PASS");
