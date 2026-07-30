# Safe extraction

Use `strict` for normal work and `untrusted` for external input. `compatible`
accepts more archive variations and is suitable only when the producer is
trusted.

```js
const report = await audit(input, {
  safetyProfile: "untrusted",
  limits: {
    maxEntries: 5_000,
    maxUncompressedEntryBytes: 64 * 1024 * 1024,
    maxTotalUncompressedBytes: 512 * 1024 * 1024,
    maxCompressionRatio: 200,
  },
});

if (!report.isSafe) {
  throw new Error(`Archive rejected: ${JSON.stringify(report.issues)}`);
}
```

`extract()` performs the same gate itself. A separate `audit()` call is useful
only when the application needs to inspect or approve the report first.

## Use a staging directory

Extraction is not atomic. It can replace files and leave completed entries
behind if a later entry fails.

Use a newly created directory beneath a trusted parent:

```js
import { mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { extract } from "dir-archiver";

const parent = resolve("./archive-staging");
await mkdir(parent, { recursive: true });
const staging = await mkdtemp(join(parent, ".extract-"));

try {
  await extract("./incoming.zip", staging, {
    safetyProfile: "untrusted",
    maxExtractedFileBytes: 64 * 1024 * 1024,
    maxTotalExtractedBytes: 512 * 1024 * 1024,
  });
  await rename(staging, join(parent, "published"));
} catch (error) {
  await rm(staging, { recursive: true, force: true });
  throw error;
}
```

Do not extract through pre-existing symlinked path components. Lexical path
checks cannot make an arbitrary existing filesystem tree safe.

## Links

Symlinks are skipped by default. `allowSymlinks: true` permits only non-empty,
relative targets without `..`; the selected Bytefold profile can still reject
the archive before materialization. Hard links are always rejected.

## Limits

`limits` protects parsing, decompression, and archive entry accounting.
`maxExtractedFileBytes` and `maxTotalExtractedBytes` protect filesystem
materialization. Use both for external archives.

Each regular entry is currently buffered in memory, so
`maxExtractedFileBytes` must fit the process memory budget as well as the disk
budget.
