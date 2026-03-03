# How-to: extract untrusted archives safely

## Goal
Prevent path traversal and decompression amplification from turning extraction
into a filesystem or resource-exhaustion risk.

## Prereqs
- Node `>=24`
- `npm install`
- `npm run build`

## Copy/paste
Recommended pattern (audit first, then extract with limits):

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

Runnable example file:

```sh
node examples/extract-untrusted.mjs
```

## What you should see
- The audit step succeeds before extraction starts.
- The example intentionally sets a low extraction limit and reports
  `DIRARCHIVER_RESOURCE_LIMIT`.

## Safety notes
> [!CAUTION]
> Never extract untrusted archives without limits. Attackers can use deeply
> nested or highly compressed entries to trigger large disk writes
> (`CWE-409`-style decompression amplification).
>
> [!CAUTION]
> Keep `profile: "strict"` or `"agent"` for untrusted input. These profiles
> reject traversal-style paths and unsafe entry classes during extraction.
>
> [!WARNING]
> Symlink and hardlink handling changes the risk envelope:
> - `allowSymlinks` defaults to `false`.
> - `allowHardlinks` currently remains unsupported and triggers
>   `DIRARCHIVER_UNSUPPORTED_ENTRY`.
