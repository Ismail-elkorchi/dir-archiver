# Troubleshooting

Start with the operation, process exit code, error type, stable package code when present, runtime, and format. Do not diagnose an API or CLI failure from message text alone.

## Quick diagnosis

| Symptom | Likely explanation | First action |
| --- | --- | --- |
| CLI `audit` exits `0` but the archive should be rejected | `audit` completed and returned a report whose `ok` field may be `false` | Parse the report and fail the job when `ok` is false. |
| An exit-`1` stderr value is not JSON | The failure came from the filesystem, network, cancellation, or a dependency rather than `DirArchiverError` | Treat stderr as diagnostic text unless it parses as the documented error envelope. |
| API error has no `code` | Not every operational failure is wrapped by `DirArchiverError` | Check `instanceof DirArchiverError`, then handle other errors separately. |
| `DIRARCHIVER_PATH_TRAVERSAL` | An entry or enabled symlink target failed containment checks | Reject or rebuild the archive; do not retry with a weaker profile. |
| `DIRARCHIVER_RESOURCE_LIMIT` | A materialized entry or total output exceeded explicit extraction limits | Inspect the archive and application budget before raising limits. |
| `DIRARCHIVER_UNSUPPORTED_ENTRY` | Audit policy, an entry type, hard link, or a write capability was rejected | Run `audit()` and `list()`, then inspect the archive and chosen format. |
| `DIRARCHIVER_NORMALIZE_UNSUPPORTED` | The opened format has no normalization operation | Check the format matrix or skip normalization. |
| Writing `bz2`, `tar.bz2`, `xz`, or `tar.xz` fails | Those writer formats are unsupported in the current implementation | Choose ZIP, TAR, gzip, Zstandard, or Brotli where the target runtime supports it. |
| Deno fails on Zstandard or Brotli | Those operations are capability-gated in the current Deno adapter | Use another format or run that workflow on Node.js/Bun. |
| `write()` reports `tar.gz` for `.tgz`, while read detection reports `tgz` | Write inference and read-side filename detection use different aliases for the same format family | Treat `tgz` and `tar.gz` as equivalent or force the identifier explicitly. |
| The archive contains itself | The destination was created inside the source directory | Move the destination outside the source or exclude its exact relative path. |
| A previous archive was lost after a failed write | The destination is opened and replaced before all source files are added | Write to a temporary sibling and rename it only after success. |
| Empty directories disappeared | `write()` emits file entries, not empty directory entries | Add a marker file or use a lower-level writer when empty directories matter. |
| Mode or modification time changed | The directory wrapper does not preserve source filesystem metadata | Normalize expectations or use a lower-level writer with metadata options. |
| Files were overwritten or left after failure | Extraction is not transactional | Extract into a fresh staging directory and remove it on failure. |
| An exclusion did not match | Exclusions are basename or exact relative-path matches, not globs | Print the archive with `list()` and correct the match. |

## Audit completed but did not fail the job

The CLI exit code reports whether the command ran, not whether the audit report is acceptable.

```sh
npx dir-archiver audit --input ./incoming.zip --profile agent --json > audit.json
```

Check the report with a script:

```js
import { readFile } from "node:fs/promises";

const report = JSON.parse(await readFile("audit.json", "utf8"));

if (!report.ok) {
  console.error(report.issues);
  process.exitCode = 1;
}
```

The API has the same report semantics:

```js
import { audit } from "dir-archiver";

const report = await audit("./incoming.zip", { profile: "agent" });
if (!report.ok) {
  console.error(report.issues);
}
```

See [Use audit as a gate](cli.md#use-audit-as-a-gate).

## Handle package and non-package errors

Only known wrapper failures are guaranteed to be `DirArchiverError`.

```js
import { DirArchiverError, extract } from "dir-archiver";

try {
  await extract("./incoming.zip", "./staging/out", {
    profile: "strict",
    maxTotalExtractedBytes: 512 * 1024 * 1024,
  });
} catch (error) {
  if (error instanceof DirArchiverError) {
    console.error({
      code: error.code,
      context: error.context,
    });
  } else if (error instanceof Error) {
    console.error({
      name: error.name,
      message: error.message,
    });
  } else {
    console.error(error);
  }
}
```

Common native or dependency failures include:

- `ENOENT`: a source or input path does not exist;
- `EACCES` or `EPERM`: the process lacks filesystem permission;
- network and HTTP errors for URL input;
- `AbortError` or another cancellation error;
- codec capability errors;
- malformed archive errors produced before the wrapper can map them.

The stable package code union includes reserved source and destination code names, but current filesystem failures are not all converted into those codes.

## Parse CLI output defensively

With `--json`:

- successful commands write JSON to stdout;
- usage failures write `DIRARCHIVER_USAGE` JSON to stdout and exit `2`;
- known `DirArchiverError` failures write JSON to stderr and exit `1`;
- other exit-`1` failures can write a stack or message to stderr.

Capture the streams separately:

```sh
npx dir-archiver extract --input ./incoming.zip --output ./staging/out --profile strict --json > result.json 2> error.txt
```

Check the exit code before parsing `result.json`. On exit `1`, attempt to parse `error.txt` as JSON only after confirming it has the expected envelope; otherwise retain it as diagnostic text.

## The archive contains the destination

Problematic layout:

```txt
project/
  src/index.js
  project.zip
```

Problematic call:

```js
await write("./project", "./project/project.zip");
```

`write()` opens the destination before walking the source. The new output file can therefore be discovered as a source entry.

Preferred layout:

```js
await write("./project", "./artifacts/project.zip");
```

When moving the output is impossible, exclude the exact relative path, but a separate artifact directory remains easier to reason about.

## A write replaced the previous destination before failing

`write()` is not transactional. It opens the destination before reading and adding every source file. An existing archive can therefore be replaced even when a later source read or writer operation fails.

Write to a temporary sibling and rename only after success:

```js
import { rename, rm } from "node:fs/promises";
import { write } from "dir-archiver";

const temporary = "./artifacts/project.pending.zip";
const published = "./artifacts/project.zip";

try {
  await write("./project", temporary, {
    format: "zip",
    includeBaseDirectory: true,
  });
  await rename(temporary, published);
} catch (error) {
  await rm(temporary, { force: true });
  throw error;
}
```

Replacing an existing published file atomically is platform- and application-specific. Choose the final publication strategy for the target filesystem rather than assuming one rename pattern works everywhere.

## Files landed at the wrong archive root

Given `project/src/index.js`, the default stores `src/index.js`.

Use `includeBaseDirectory` to store `project/src/index.js`:

```js
import { write } from "dir-archiver";

await write("./project", "./artifacts/project.zip", {
  includeBaseDirectory: true,
});
```

CLI:

```sh
npx dir-archiver write --source ./project --output ./artifacts/project.zip --include-base-directory
```

Verify the result with `list()` or `npx dir-archiver list --input ./artifacts/project.zip --json`.

## Exclusions did not match

```js
import { list, write } from "dir-archiver";

await write("./project", "./artifacts/project.zip", {
  exclude: [
    "node_modules",    // basename anywhere in the tree
    ".git",            // basename anywhere in the tree
    "build/debug.log", // exact source-relative path
  ],
});

const result = await list("./artifacts/project.zip");
console.log(result.entries.map((entry) => entry.name));
```

These do not behave as globs:

```txt
*.log
build/**
```

On Windows, matching is case-insensitive. On other supported platforms, use the source path's case.

## Format detection was unexpected

Run detection first:

```sh
npx dir-archiver detect --input ./artifact --json
```

For a generic filename or non-path input, supply a hint or force the format in the API:

```js
await detect(bytes, { filename: "artifact.tar.br" });
await detect(bytes, { format: "tar.br" });
```

For the CLI, use `--format`:

```sh
npx dir-archiver list --input ./artifact --format tar.br --json
```

A forced format must match the bytes. It does not convert them.

For gzip-compressed TAR, read-side filename inference in bytefold `0.8.x` reports `tgz` for both `.tgz` and `.tar.gz`. By contrast, `write()` destination inference reports `tar.gz` for both suffixes. The bytes and format family are equivalent; force `format` only when the exact alias matters to your application.

## Write format was rejected

Current writer restrictions are operation-specific:

- `bz2` and `tar.bz2` are not writable;
- `xz` and `tar.xz` are not writable;
- a directory requested as `bz2` maps to `tar.bz2` and then fails;
- a directory requested as `xz` maps to `tar.xz` and then fails;
- Deno additionally capability-gates Zstandard and Brotli.

Read [Formats](formats.md) before selecting a non-ZIP output.

## Resource limits failed

Two limit layers can fail:

1. bytefold reader limits inside `limits`, often surfaced as dependency errors;
2. wrapper materialization limits, surfaced as `DIRARCHIVER_RESOURCE_LIMIT`.

Inspect before changing policy:

```js
import { audit, list } from "dir-archiver";

const inventory = await list("./incoming.zip", {
  limits: { maxEntries: 5_000 },
});

console.log(inventory.entries.map(({ name, size }) => ({ name, size })));

const report = await audit("./incoming.zip", {
  profile: "agent",
});

console.log(report.summary, report.issues);
```

Archive entry sizes are strings. Convert them to `BigInt` when summing values that may exceed JavaScript's safe integer range.

Do not raise limits solely to make an unknown archive pass. Compare the requested resources with the application's memory, disk, time, and tenant quotas.

## Partial extraction or overwritten files

`extract()` creates the destination before audit, replaces matching files, and leaves completed work after a later failure.

Response:

1. stop using the failed destination;
2. remove the entire staging directory;
3. fix the input or policy;
4. retry in a newly created directory.

Do not retry into the same partly populated path. See [Recommended extraction flow](safety.md#recommended-extraction-flow).

## Normalization failed

Check these points:

- the source and destination are different paths;
- the source format supports normalization;
- Deno has the required codec capability;
- the destination parent is writable;
- a partial destination is removed after failure;
- the destination extension matches the source format, because normalization does not convert formats.

Bare `gz`, `bz2`, `xz`, `zst`, and `br` are not normalizable in the current Node.js/Bun matrix. See [Formats](formats.md#normalize-is-not-conversion).

## Diagnostic sequence

For an unknown archive failure, run non-mutating operations first:

```sh
npx dir-archiver detect --input ./incoming.zip --json
npx dir-archiver list --input ./incoming.zip --json
npx dir-archiver audit --input ./incoming.zip --profile agent --json
```

Then record:

- runtime and runtime version;
- `dir-archiver` version;
- API call or exact CLI command;
- input format and how it was detected;
- process exit code;
- stdout and stderr separately;
- `DirArchiverError.code` and `context` when present;
- audit `schemaVersion`, `ok`, summary, and issues;
- a minimal non-sensitive archive fixture when possible.

Use [SUPPORT.md](../SUPPORT.md) when opening an issue.

## Related pages

- [API guide](api.md)
- [CLI guide](cli.md)
- [Safety](safety.md)
- [Formats](formats.md)
