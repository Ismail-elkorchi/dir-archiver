# dir-archiver

Create, inspect, audit, normalize, and extract archives from JavaScript, TypeScript, and automation scripts.

`dir-archiver` gives application and CLI consumers one API for common archive jobs across ZIP, TAR, and layered compression formats. It supports Node.js, Deno, and Bun.

## Install

```sh
npm install dir-archiver
```

```sh
deno add jsr:@ismail-elkorchi/dir-archiver
```

```sh
bun add dir-archiver
```

## Create a ZIP from a directory

```ts
import { write } from "dir-archiver";

const result = await write("./project", "./project.zip", {
  // Keep files under project/ inside the archive instead of placing them
  // directly at the archive root.
  includeBaseDirectory: true,

  // Exclude exact basenames or relative paths from the source directory.
  exclude: ["node_modules", ".git", "dist/tmp.txt"],
});

console.log(`Created ${result.format} with ${result.entryCount} files`);
```

`write()` infers the archive format from the destination extension. Use `format` when you want to override inference:

```ts
await write("./project", "./bundle", {
  format: "zip",
  includeBaseDirectory: true,
});
```

## Inspect before extracting

```ts
import { detect, list, audit } from "dir-archiver";

const input = "./incoming.zip";

const detected = await detect(input);
console.log(`Detected ${detected.format}`);

const listed = await list(input);
for (const entry of listed.entries) {
  console.log(entry.name);
}

const report = await audit(input, { profile: "agent" });
if (!report.ok) {
  console.error(report.issues);
  process.exitCode = 1;
}
```

Use `list()` when you need to see archive entries without writing files. Use `audit()` when an archive came from a user upload, CI artifact, external service, or any other untrusted source.

## Extract safely

```ts
import { DirArchiverError, extract } from "dir-archiver";

try {
  await extract("./incoming.zip", "./out", {
    // strict is the default for extract(); set it here to make the policy visible.
    profile: "strict",

    // Limit extraction so one archive cannot consume unlimited disk space.
    maxEntryBytes: 64 * 1024 * 1024,
    maxTotalExtractedBytes: 512 * 1024 * 1024,
  });
} catch (error) {
  if (error instanceof DirArchiverError) {
    // Branch on stable error codes, not message text.
    console.error(error.code);
  } else {
    throw error;
  }
}
```

## Use the CLI

After installing the package, use the `dir-archiver` binary from your package manager or project scripts.

```sh
npx dir-archiver write \
  --source ./project \
  --output ./project.zip \
  --include-base-directory \
  --exclude node_modules \
  --exclude .git \
  --json
```

```sh
npx dir-archiver extract \
  --input ./project.zip \
  --output ./out \
  --profile strict \
  --max-total-extracted-bytes 536870912 \
  --json
```

For automation, pass `--json` and use exit codes:

| Exit code | Meaning |
| --- | --- |
| `0` | Command completed successfully. |
| `1` | Archive or runtime operation failed. |
| `2` | Command usage or validation failed. |

## Core operations

| Operation | Use it for |
| --- | --- |
| `write(source, destination, options?)` | Create an archive from a file or directory. |
| `detect(input, options?)` | Identify the archive format without extracting. |
| `list(input, options?)` | Read archive entries without extracting. |
| `audit(input, options?)` | Check archive paths, links, limits, and profile rules. |
| `extract(input, destination, options?)` | Extract files with explicit safety and size controls. |
| `normalize(input, destination, options?)` | Rewrite supported archives into deterministic output. |
| `open(input, options?)` | Access the lower-level archive reader for advanced flows. |

## Safety model

Archive extraction writes paths from an input file onto your filesystem. Treat archive inputs as untrusted unless your application created them in the same trust boundary.

`extract()` defaults to `profile: "strict"`. In strict and agent profiles, `dir-archiver` audits before extraction and rejects unsafe paths such as absolute paths or `..` traversal. Symlinks are skipped unless explicitly allowed. Hard-link entries are rejected in the current v3 behavior.

Use resource limits for external archives:

```ts
await extract("./incoming.zip", "./out", {
  profile: "strict",
  maxEntryBytes: 64 * 1024 * 1024,
  maxTotalExtractedBytes: 512 * 1024 * 1024,
});
```

Read [Safety](docs/safety.md) for the full extraction model.

## Supported formats

The public format names are:

```txt
zip, tar, tgz, tar.gz, gz, bz2, tar.bz2, zst, tar.zst, br, tar.br, xz, tar.xz
```

Read [Formats](docs/formats.md) for operation-level support notes and directory wrapping behavior.

## Compatibility and boundaries

- Module system: ESM-only.
- Runtimes: Node.js `>=24`, current Deno, and current Bun.
- CommonJS-only applications need an ESM bridge or a different integration layer.
- `dir-archiver` is not an interactive archive browser UI.
- Consumers should rely on `DirArchiverError.code` and documented JSON fields, not free-form message text.

## Documentation

Start here:

- [Getting started](docs/getting-started.md)
- [API guide](docs/api.md)
- [CLI guide](docs/cli.md)
- [Safety](docs/safety.md)
- [Formats](docs/formats.md)
- [Troubleshooting](docs/troubleshooting.md)

Recipes:

- [Create a ZIP from a directory](docs/recipes/create-zip-from-directory.md)
- [Inspect an archive before extracting](docs/recipes/inspect-archive-before-extracting.md)
- [Extract an untrusted archive](docs/recipes/extract-untrusted-archive.md)
- [Create a release artifact](docs/recipes/create-release-artifact.md)
- [Normalize an archive](docs/recipes/normalize-archive.md)

Public behavior guarantees are listed in [CONTRACT.md](CONTRACT.md).

## Contributor verification

```sh
npm run examples:run
npm run check:fast
npm run check
```
