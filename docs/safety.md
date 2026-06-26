# Safety

Archive extraction is a filesystem write operation. Treat archive inputs as untrusted unless your application created them inside the same trust boundary.

This page explains the safety controls exposed by `dir-archiver` and how to use them.

## Main risks

| Risk | Why it matters | Control |
| --- | --- | --- |
| Path traversal | An entry such as `../app.js` can try to write outside the destination directory. | Use `profile: "strict"` or `profile: "agent"`. |
| Absolute paths | An entry can try to write to `/tmp/x` or a drive-prefixed path. | Strict and agent profiles reject these paths. |
| Symlinks | A link can point reads or writes somewhere unexpected. | Symlinks are skipped unless explicitly allowed. |
| Hard links | Hard links can alias files in ways consumers may not expect. | Hard links are rejected in current v3 behavior. |
| Resource exhaustion | A compressed archive can expand far beyond its input size. | Set `maxEntryBytes` and `maxTotalExtractedBytes`. |

## Profiles

Profiles configure how much checking happens before or during archive reads.

| Profile | Meaning | Good fit |
| --- | --- | --- |
| `compat` | Minimal guardrails. | Trusted archives created by your own process. |
| `strict` | Blocks unsafe paths and entries before extraction. | Default choice for extraction. |
| `agent` | Strict posture plus additional reader assertions for automation. | CI, queue workers, release gates, and upload pipelines. |

`extract()` defaults to `strict`. Keep the profile visible in code when safety review matters:

```ts
await extract("./incoming.zip", "./out", {
  profile: "strict",
});
```

## Recommended pattern for untrusted archives

```ts
import { DirArchiverError, audit, extract } from "dir-archiver";

const input = "./incoming.zip";
const destination = "./out";

// Step 1: inspect the archive without writing files.
const report = await audit(input, {
  profile: "agent",
});

if (!report.ok) {
  console.error(JSON.stringify(report.issues, null, 2));
  process.exit(1);
}

// Step 2: extract only after audit passes, with strict checks and byte limits.
try {
  await extract(input, destination, {
    profile: "strict",
    maxEntryBytes: 64 * 1024 * 1024,
    maxTotalExtractedBytes: 512 * 1024 * 1024,
  });
} catch (error) {
  if (error instanceof DirArchiverError) {
    console.error(error.code);
  } else {
    throw error;
  }
}
```

## Recommended CLI pattern

```sh
dir-archiver audit \
  --input ./incoming.zip \
  --profile agent \
  --json

mkdir -p ./out

dir-archiver extract \
  --input ./incoming.zip \
  --output ./out \
  --profile strict \
  --max-entry-bytes 67108864 \
  --max-total-extracted-bytes 536870912 \
  --json
```

For automation, parse JSON output and handle exit codes separately.

## Resource limits

Set extraction limits whenever the archive came from outside your process.

```ts
await extract("./incoming.zip", "./out", {
  maxEntryBytes: 64 * 1024 * 1024,
  maxTotalExtractedBytes: 512 * 1024 * 1024,
});
```

| Limit | Meaning |
| --- | --- |
| `maxEntryBytes` | Maximum bytes allowed for one extracted file. |
| `maxTotalExtractedBytes` | Maximum total bytes written during one extraction run. |

A limit failure throws or emits `DIRARCHIVER_RESOURCE_LIMIT`.

## Symlinks and hard links

By default, symlink entries are skipped and counted in `skippedEntries`.

```ts
const result = await extract("./incoming.zip", "./out", {
  profile: "strict",
});

console.log(result.skippedEntries);
```

Only enable symlinks when your application has a documented reason and the destination directory is isolated:

```ts
await extract("./trusted.zip", "./out", {
  profile: "strict",
  allowSymlinks: true,
});
```

Hard-link entries are rejected in the current v3 behavior with `DIRARCHIVER_UNSUPPORTED_ENTRY`.

## Path traversal behavior

Strict and agent extraction reject archive entries that try to escape the destination root:

```txt
../outside.txt
/absolute/path.txt
C:/absolute/path.txt
nested/../../outside.txt
```

Traversal failures use `DIRARCHIVER_PATH_TRAVERSAL` when the unsafe condition is path-based.

## Error handling checklist

- Branch on `DirArchiverError.code` instead of message text.
- Treat `DIRARCHIVER_PATH_TRAVERSAL` as a blocked unsafe archive.
- Treat `DIRARCHIVER_RESOURCE_LIMIT` as a signal to inspect the archive before raising limits.
- Treat `DIRARCHIVER_UNSUPPORTED_ENTRY` as a policy or format mismatch.
- Keep stdout and stderr separate when using the CLI with `--json`.

## Related pages

- [Extract an untrusted archive](recipes/extract-untrusted-archive.md)
- [API guide](api.md#extractinput-destination-options)
- [CLI guide](cli.md#extract)
- [Troubleshooting](troubleshooting.md)
- [Security policy](../SECURITY.md)
