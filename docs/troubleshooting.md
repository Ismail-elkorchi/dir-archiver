# Troubleshooting

Start with the operation, runtime, format, process exit code, and error type. Use a stable package code when one is present, but do not assume every failure is a `DirArchiverError`.

## Quick diagnosis

| Symptom | Likely explanation | First action |
| --- | --- | --- |
| CLI `audit` exits `0` but the archive should be rejected | The command completed and returned a report whose `ok` field is `false` | Parse the report and fail the job when `ok` is false. |
| Exit-`1` stderr is not JSON | A filesystem, network, cancellation, parser, or codec error bypassed `DirArchiverError` | Retain stderr as diagnostic text instead of parsing it unconditionally. |
| API error has no `code` | Not every operational failure is wrapped | Check `instanceof DirArchiverError`, then handle other errors separately. |
| `DIRARCHIVER_PATH_TRAVERSAL` | An entry or enabled symlink target failed containment checks | Reject or rebuild the archive. |
| `DIRARCHIVER_RESOURCE_LIMIT` | A materialized entry or total output exceeded explicit extraction limits | Inspect the archive and resource budget before raising limits. |
| `DIRARCHIVER_UNSUPPORTED_ENTRY` | Audit policy, an entry type, hard link, or a known writer capability was rejected | Run `audit()` and `list()`, then inspect the input and selected format. |
| `DIRARCHIVER_NORMALIZE_UNSUPPORTED` | The opened reader has no normalization operation | Check [Formats](formats.md) or skip normalization. |
| Deno fails on Zstandard or Brotli | Those operations are capability-gated in the current Deno adapter | Choose another format or use Node.js/Bun for that workflow. |
| `write()` reports `tar.gz`, while read detection reports `tgz` | Write inference and read inference use different aliases for the same format family | Treat them as equivalent or force `format`. |
| The archive contains itself | The destination was created inside the source directory | Move the destination outside the source tree. |
| A previous archive disappeared after a failed write | The destination was replaced before all source files were added | Write to a temporary sibling and publish only after success. |
| Empty directories disappeared | The directory writer emits file entries | Add a marker file or use a lower-level writer when empty directories matter. |
| Mode or modification time changed | The directory wrapper does not preserve source filesystem metadata | Use a lower-level writer when metadata preservation is required. |
| Files were overwritten or left after extraction failed | Extraction is not transactional | Remove the staging directory and retry in a new one. |
| An exclusion did not match | Exclusions are basenames or exact relative paths, not globs | List the result and correct the match. |

## Audit completed but did not fail the job

The CLI exit code reports whether `audit` produced a report, not whether that report is acceptable.

Create `check-audit.mjs`:

```js
import { readFile } from "node:fs/promises";

const report = JSON.parse(await readFile(process.argv[2], "utf8"));

if (!report.ok) {
  console.error(JSON.stringify(report.issues, null, 2));
  process.exitCode = 1;
}
```

Run the checker only after the audit command succeeds operationally:

```sh
npx dir-archiver audit --input ./incoming.zip --profile agent --json > audit.json && node check-audit.mjs audit.json
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

```js
import { DirArchiverError, extract } from "dir-archiver";

try {
  await extract("./incoming.zip", "./staging/out", {
    profile: "strict",
    maxTotalExtractedBytes: 512 * 1024 * 1024,
  });
} catch (error) {
  if (error instanceof DirArchiverError) {
    console.error({ code: error.code, context: error.context });
  } else if (error instanceof Error) {
    console.error({ name: error.name, message: error.message });
  } else {
    console.error(error);
  }
}
```

Common non-package failures include:

- `ENOENT` for a missing path;
- `EACCES` or `EPERM` for filesystem permissions;
- HTTP and network failures for URL input;
- cancellation errors;
- dependency resource-limit or codec-capability errors;
- malformed archive errors produced before the wrapper can map them.

The stable code union includes source and destination validation names, but current filesystem failures are not all converted into those codes.

## Parse CLI output defensively

With `--json`:

- successful commands write JSON to stdout;
- usage failures write `DIRARCHIVER_USAGE` JSON to stdout and exit `2`;
- known `DirArchiverError` failures write JSON to stderr and exit `1`;
- other exit-`1` failures can write a stack or message to stderr.

Capture streams separately and check the exit code before parsing stdout:

```sh
npx dir-archiver extract --input ./incoming.zip --output ./staging/out --profile strict --json > result.json 2> error.txt
```

On exit `1`, parse `error.txt` as JSON only after confirming that it has the documented package envelope.

## The archive contains the destination

Problematic call:

```js
await write("./project", "./project/project.zip");
```

`write()` opens the destination before walking a directory source, so the new file can be discovered during traversal.

Preferred layout:

```js
await write("./project", "./artifacts/project.zip");
```

A separate artifact directory is easier to verify than excluding the output path from its own source tree.

## A write replaced the previous destination before failing

`write()` is not transactional. Use a temporary sibling and rename only after success:

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

Replacing an existing published file atomically is platform- and application-specific. Select a publication strategy for the target filesystem rather than assuming one rename pattern works everywhere.

## Files landed at the wrong archive root

Given `project/src/index.js`, the default stores `src/index.js`. Set `includeBaseDirectory` to store `project/src/index.js`:

```js
await write("./project", "./artifacts/project.zip", {
  includeBaseDirectory: true,
});
```

CLI:

```sh
npx dir-archiver write --source ./project --output ./artifacts/project.zip --include-base-directory
```

Verify the result with `list()` or the CLI `list` command.

## Exclusions did not match

```js
await write("./project", "./artifacts/project.zip", {
  exclude: [
    "node_modules",    // basename anywhere in the tree
    ".git",            // basename anywhere in the tree
    "build/debug.log", // exact source-relative path
  ],
});
```

These are not globs:

```txt
*.log
build/**
```

Matching is case-insensitive on Windows and case-sensitive on other supported platforms. `exclude` applies to directory traversal, not to a single-file source.

## Format detection was unexpected

```sh
npx dir-archiver detect --input ./artifact --json
```

For a generic filename or in-memory input, supply a hint or force the format:

```js
await detect(bytes, { filename: "artifact.tar.br" });
await detect(bytes, { format: "tar.br" });
```

A forced format must match the bytes; it does not convert them.

Current read-side filename inference reports `tgz` for both `.tgz` and `.tar.gz`. `write()` destination inference reports `tar.gz` for both suffixes. The identifiers describe the same format family.

## Write format was rejected

Current writer restrictions are operation-specific:

- `bz2` and `tar.bz2` are not writable;
- `xz` and `tar.xz` are not writable;
- directory requests for `bz2` or `xz` are mapped to the corresponding TAR format and then rejected;
- Deno additionally capability-gates Zstandard and Brotli.

Read [Formats](formats.md) before selecting a non-ZIP output.

## Resource limits failed

Two limit layers can fail:

1. reader and decompression limits inside `limits`, often surfaced as dependency errors;
2. wrapper materialization limits, surfaced as `DIRARCHIVER_RESOURCE_LIMIT`.

Inspect before changing policy:

```js
import { audit, list } from "dir-archiver";

const inventory = await list("./incoming.zip", {
  limits: { maxEntries: 5_000 },
});
console.log(inventory.entries.map(({ name, size }) => ({ name, size })));

const report = await audit("./incoming.zip", { profile: "agent" });
console.log(report.summary, report.issues);
```

Entry sizes are strings. Use `BigInt` when summing values that may exceed JavaScript's safe integer range. Compare requested resources with the application's memory, disk, time, and tenant budgets before raising limits.

## Partial extraction or overwritten files

After an extraction failure:

1. stop using the failed destination;
2. remove the whole staging directory;
3. fix the input or policy;
4. retry in a new directory.

Do not retry into the same partly populated path. See [Recommended extraction flow](safety.md#recommended-extraction-flow).

## Normalization failed

Check that:

- source and destination are different paths;
- the source format supports normalization;
- the runtime has the required codec capability;
- the destination parent is writable;
- partial output is removed after failure;
- the destination extension describes the source format, because normalization does not convert formats.

Bare `gz`, `bz2`, `xz`, `zst`, and `br` inputs are not normalizable in the current Node.js/Bun matrix. See [Formats](formats.md#normalize-is-not-conversion).

## Diagnostic sequence

Run non-mutating operations first:

```sh
npx dir-archiver detect --input ./incoming.zip --json
npx dir-archiver list --input ./incoming.zip --json
npx dir-archiver audit --input ./incoming.zip --profile agent --json
```

Record:

- runtime, runtime version, and operating system;
- `dir-archiver` version;
- API call or exact CLI command;
- input kind and format;
- process exit code;
- stdout and stderr separately;
- `DirArchiverError.code` and `context` when present;
- audit `schemaVersion`, `ok`, summary, and issues;
- a minimal non-sensitive fixture when possible.

Use [SUPPORT.md](../SUPPORT.md) when opening an issue.

## Related pages

- [API guide](api.md)
- [CLI guide](cli.md)
- [Safety](safety.md)
- [Formats](formats.md)
