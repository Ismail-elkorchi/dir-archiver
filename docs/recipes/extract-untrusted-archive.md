# Extract an untrusted archive

Use this recipe for archives that come from users, uploads, external systems, package registries, or CI inputs.

## API

```ts
import { DirArchiverError, audit, extract } from "dir-archiver";

const input = "./incoming.zip";
const output = "./out";

const report = await audit(input, {
  // agent uses the strict safety posture plus additional reader assertions.
  profile: "agent",
});

if (!report.ok) {
  console.error(JSON.stringify(report.issues, null, 2));
  process.exit(1);
}

try {
  const result = await extract(input, output, {
    profile: "strict",
    maxEntryBytes: 64 * 1024 * 1024,
    maxTotalExtractedBytes: 512 * 1024 * 1024,
  });

  console.log(result);
} catch (error) {
  if (error instanceof DirArchiverError) {
    console.error(error.code);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
```

## CLI

```sh
dir-archiver audit \
  --input ./incoming.zip \
  --profile agent \
  --json

dir-archiver extract \
  --input ./incoming.zip \
  --output ./out \
  --profile strict \
  --max-entry-bytes 67108864 \
  --max-total-extracted-bytes 536870912 \
  --json
```

## Why this works

- `audit` checks the archive before files are written.
- `profile: "strict"` rejects unsafe paths before extraction.
- `maxEntryBytes` blocks one oversized file entry.
- `maxTotalExtractedBytes` blocks the total extraction from growing beyond your budget.
- Symlink entries are skipped unless you explicitly allow them.
- Hard-link entries are rejected in current v3 behavior.

## Common failures

| Error code | Meaning | Usual response |
| --- | --- | --- |
| `DIRARCHIVER_PATH_TRAVERSAL` | An entry tried to escape the destination directory. | Reject the archive. |
| `DIRARCHIVER_RESOURCE_LIMIT` | The archive exceeded a configured size limit. | Inspect the archive before raising limits. |
| `DIRARCHIVER_UNSUPPORTED_ENTRY` | The archive contains an unsupported entry or failed audit. | Inspect audit issues and decide whether the input is acceptable. |

## Related pages

- [Safety](../safety.md)
- [Inspect before extracting](inspect-archive-before-extracting.md)
- [API guide](../api.md#extractinput-destination-options)
- [CLI guide](../cli.md#extract)
