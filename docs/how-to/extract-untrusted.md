# How-to: extract untrusted archives safely

## Goal
Prevent path traversal and decompression amplification from turning extraction
into a filesystem or resource-exhaustion risk.

## Prereqs
- Node `>=24`
- `npm install`
- `npm run build`

## Copy/paste
Runnable example file:

```sh
node examples/extract-untrusted.mjs
```

Equivalent API pattern (audit first, then extract with limits):

```ts
import { audit, extract } from "dir-archiver";

const input = "./incoming.zip";
const report = await audit(input, { profile: "agent" });
if (!report.ok) {
  console.error(JSON.stringify({ ok: false, issues: report.issues }, null, 2));
  process.exit(1);
}

await extract(input, "./out", {
  profile: "strict",
  maxEntryBytes: 64 * 1024 * 1024,
  maxTotalExtractedBytes: 512 * 1024 * 1024,
});
```

## What you should see
- The audit step succeeds before extraction starts.
- The example intentionally sets a low extraction limit and reports
  `DIRARCHIVER_RESOURCE_LIMIT`.

## Common failure modes
- `profile: "compat"` is used for hostile input, which weakens pre-extract
  safety checks.
- Limits are left unset, so decompression amplification can consume far more
  disk than expected.
- Callers treat file creation as success instead of checking the returned issues
  and skipped-entry counts.

## Related reference
- [CLI reference](../reference/cli.md)
- [Options reference](../reference/options.md)
- [Contract](../../CONTRACT.md)
