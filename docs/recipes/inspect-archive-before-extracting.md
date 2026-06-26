# Inspect an archive before extracting

Use this recipe when you need to see what an archive contains before writing files to disk.

## API

```ts
import { audit, detect, list } from "dir-archiver";

const input = "./incoming.zip";

const detected = await detect(input);
console.log(`format: ${detected.format}`);

const listed = await list(input);
for (const entry of listed.entries) {
  console.log({
    name: entry.name,
    size: entry.size,
    isDirectory: entry.isDirectory,
    isSymlink: entry.isSymlink,
  });
}

const report = await audit(input, {
  profile: "agent",
});

if (!report.ok) {
  console.error(JSON.stringify(report.issues, null, 2));
  process.exitCode = 1;
}
```

## CLI

```sh
dir-archiver detect --input ./incoming.zip --json

dir-archiver list --input ./incoming.zip --json

dir-archiver audit \
  --input ./incoming.zip \
  --profile agent \
  --json
```

## What to check

Before extracting, check:

- entries are relative paths inside the expected directory structure
- file sizes are reasonable for your application
- symlinks are expected or can be skipped
- audit returns `ok: true`

## Next extraction step

```ts
import { extract } from "dir-archiver";

await extract("./incoming.zip", "./out", {
  profile: "strict",
  maxEntryBytes: 64 * 1024 * 1024,
  maxTotalExtractedBytes: 512 * 1024 * 1024,
});
```

## Related pages

- [Extract an untrusted archive](extract-untrusted-archive.md)
- [Safety](../safety.md)
- [Troubleshooting](../troubleshooting.md)
