# dir-archiver

Create, inspect, audit, normalize, and extract archives through one ESM API.

`dir-archiver` supports ZIP, TAR, and layered compression across Node.js, Deno, and Bun. It adds deterministic directory traversal, a small set of task-oriented operations, extraction policy controls, and stable package error codes on top of bytefold.

## Requirements and installation

| Use | Runtime | Install |
| --- | --- | --- |
| JavaScript or TypeScript API | Node.js `>=24` | `npm install dir-archiver` |
| JavaScript or TypeScript API | Current Bun | `bun add dir-archiver` |
| JavaScript or TypeScript API | Current Deno | `deno add jsr:@ismail-elkorchi/dir-archiver` |
| Command-line interface | Node.js `>=24` | Install the npm package, then run `npx dir-archiver` |

Node.js and Bun:

```js
import { write } from "dir-archiver";
```

Deno, after `deno add`:

```ts
import { write } from "@ismail-elkorchi/dir-archiver";
```

`deno add` records the JSR package in the project import map. A direct `jsr:@ismail-elkorchi/dir-archiver` import also works when you do not want an import-map entry.

The package is ESM-only. The CLI is the Node.js executable shipped by the npm package; the JSR package provides the API, not the CLI.

## First archive flow

Assume `./project` contains the files to package. Keep the output archive outside that source directory.

```js
import { extract, list, write } from "dir-archiver";

// Create project.zip. The source directory name becomes the archive root,
// so entries look like project/package.json instead of package.json.
const created = await write("./project", "./artifacts/project.zip", {
  includeBaseDirectory: true,

  // A basename matches anywhere in the tree. A path containing a separator
  // matches that exact path relative to ./project. These are not glob patterns.
  exclude: ["node_modules", ".git", "build/debug.log"],
});

console.log({
  format: created.format,
  filesWritten: created.entryCount,
});

// Inspect names and sizes without writing archive entries to disk.
const inventory = await list("./artifacts/project.zip");
for (const entry of inventory.entries) {
  console.log(entry.name, entry.size);
}

// Extract into a new, trusted destination directory. Strict is the default,
// but spelling it out makes the policy visible during review.
const extracted = await extract("./artifacts/project.zip", "./artifacts/unpacked", {
  profile: "strict",
  maxEntryBytes: 64 * 1024 * 1024,
  maxTotalExtractedBytes: 512 * 1024 * 1024,
});

console.log(extracted);
```

`entryCount` counts file entries written by `write()`. The directory writer does not preserve empty directories or source filesystem metadata such as mode and modification time.

For a self-contained runnable example, read [Getting started](docs/getting-started.md).

## Operations

| Operation | Purpose |
| --- | --- |
| `write(source, destination, options?)` | Create an archive from a local file or directory. |
| `detect(input, options?)` | Resolve the archive format without listing or extracting entries. |
| `list(input, options?)` | Return JSON-safe entry summaries without extraction. |
| `audit(input, options?)` | Return an issue report for a selected safety profile. |
| `extract(input, destination, options?)` | Extract with path checks, link policy, and optional byte limits. |
| `normalize(input, destination, options?)` | Rewrite a supported format into deterministic output of the same format. |
| `open(input, options?)` | Access the lower-level archive reader for advanced flows. |

Read the [API guide](docs/api.md) for signatures, options, return values, and operation-specific caveats.

## CLI

```sh
npx dir-archiver write --source ./project --output ./artifacts/project.zip --include-base-directory --exclude node_modules --json
```

```sh
npx dir-archiver extract --input ./artifacts/project.zip --output ./artifacts/unpacked --profile strict --max-total-extracted-bytes 536870912 --json
```

For automation, pass `--json`, keep stdout and stderr separate, and inspect both the process exit code and command payload. In particular, `audit` can exit `0` while returning `{"ok":false}` because the command itself completed successfully. The [CLI guide](docs/cli.md) includes a correct audit-gate example.

## Important behavior

- `write()` replaces an existing destination archive, reads each source file into memory before adding it, and can leave a partial destination if a later read or writer operation fails.
- Keep a write destination outside the source tree. An output created inside the source can be discovered during traversal and included in itself.
- `followSymlinks: true` follows links encountered during directory traversal and may include content outside the source tree. Use it only for a trusted source layout.
- `extract()` creates the destination, overwrites matching files, and is not transactional. A failure can leave earlier entries on disk.
- Extract into a new directory under a trusted parent. Do not extract through pre-existing symlinked path components.
- Strict extraction performs a pre-extraction audit automatically. A separate `audit()` call is useful when the application needs the report before deciding whether to extract.
- Format capabilities vary by runtime and operation. Deno does not currently provide the same Zstandard and Brotli capabilities as Node.js and Bun.
- Known package-policy failures use `DirArchiverError.code`. Filesystem and dependency failures can still surface as other error types.

Read [Safety](docs/safety.md) before processing archives from users or external systems, and [Formats](docs/formats.md) before choosing a non-ZIP format.

## Documentation

- [Documentation map](docs/index.md)
- [Getting started](docs/getting-started.md)
- [API guide](docs/api.md)
- [CLI guide](docs/cli.md)
- [Safety](docs/safety.md)
- [Formats and runtime support](docs/formats.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Public behavior contract](CONTRACT.md)

## Project information

- [Changelog](CHANGELOG.md)
- [Security policy](SECURITY.md)
- [Support](SUPPORT.md)
- License: MIT
