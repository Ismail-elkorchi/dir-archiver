# API guide

This page is the canonical reference for the programmatic `dir-archiver` surface.

## Install and import

Node.js `>=24`:

```sh
npm install dir-archiver
```

```js
import {
  DirArchiverError,
  audit,
  detect,
  extract,
  list,
  normalize,
  open,
  write,
} from "dir-archiver";
```

Bun uses the same npm package and import.

Deno:

```sh
deno add jsr:@ismail-elkorchi/dir-archiver
```

```ts
import {
  DirArchiverError,
  audit,
  detect,
  extract,
  list,
  normalize,
  open,
  write,
} from "@ismail-elkorchi/dir-archiver";
```

`deno add` records the JSR package in the project import map. A direct `jsr:@ismail-elkorchi/dir-archiver` import also works without an import-map entry.

The package is ESM-only. The default export mirrors the named operations:

```js
import dirArchiver from "dir-archiver";

await dirArchiver.write("./project", "./project.zip");
```

## Public exports

Runtime values:

```txt
open, detect, list, audit, extract, normalize, write, DirArchiverError, default
```

Type exports:

| Type | Purpose |
| --- | --- |
| `ArchiveFormat` | Public format identifier union. |
| `ArchiveProfile` | `compat`, `strict`, or `agent`. |
| `ArchiveLimits` | Reader, parser, decompression, and audit limits. |
| `ArchiveDetectionReport` | Publicly exposed detection-report shape. |
| `ArchiveIssue` | Publicly exposed report-issue shape. |
| `ArchiveNormalizeReport` | Publicly exposed normalization-report shape. |
| `DirArchiverInput` | Accepted read-input union. |
| `OpenOptions` | Shared read options. |
| `DetectResult` | `detect()` result. |
| `ListEntry`, `ListResult` | Entry summary and `list()` result. |
| `ExtractOptions`, `ExtractResult` | Extraction options and result. |
| `NormalizeOptions`, `NormalizeResult` | Normalization options and result. |
| `WriteOptions`, `WriteResult` | Writer options and result. |
| `DirArchiverErrorCode`, `DirArchiverErrorJson` | Package error code and JSON envelope. |
| `CliUsageError`, `SupportedCommandMap` | CLI contract types. |
| `DirArchiverNamespace` | Default-export type. |

The return types of `open()` and `audit()` are owned by bytefold and are not re-exported as named reader or audit-report types. Let TypeScript infer them, or define local aliases:

```ts
import { audit, open } from "dir-archiver";

type OpenedArchive = Awaited<ReturnType<typeof open>>;
type AuditReport = Awaited<ReturnType<typeof audit>>;
```

Bytefold-owned detection, audit, and normalization payloads carry their own `schemaVersion`. Do not treat every nested field as part of the wrapper's stable result contract.

## Inputs

Read operations accept:

```ts
type DirArchiverInput =
  | string
  | URL
  | Uint8Array
  | ArrayBuffer
  | ReadableStream<Uint8Array>
  | Blob;
```

A string can be a local path or an HTTP or HTTPS URL. A `URL` can identify a local file or network resource when supported by the active runtime adapter. Runtime permissions, network failures, redirects, and cancellation remain the caller's responsibility.

For bytes, streams, and blobs, supply `filename` when extension information is needed:

```js
await detect(uploadBytes, { filename: "upload.tar.br" });
```

An explicit `format` takes precedence over detection and filename hints:

```js
await detect(uploadBytes, { format: "tar.br" });
```

Forcing a format does not convert input bytes.

## Shared read options

`open()`, `detect()`, `list()`, `audit()`, `extract()`, and `normalize()` accept `OpenOptions`.

| Option | Current default | Meaning |
| --- | --- | --- |
| `format` | `"auto"` | Force a format or allow detection. |
| `filename` | unset | Supply an extension hint. |
| `profile` | current reader default is `strict` | Select `compat`, `strict`, or `agent` defaults. |
| `isStrict` | profile-driven | Advanced parser-strictness override. |
| `limits` | profile-driven | Reader, decompression, entry, and audit ceilings. |
| `signal` | unset | Cancel supported work. |
| `password` | unset | Password for encrypted ZIP members where supported. |

Current bytefold `0.8.x` limit fields include:

```txt
maxInputBytes
maxEntries
maxUncompressedEntryBytes
maxTotalUncompressedBytes
maxTotalDecompressedBytes
maxCompressionRatio
maxDictionaryBytes
maxXzDictionaryBytes
maxXzBufferedBytes
maxXzIndexRecords
maxXzIndexBytes
maxXzPreflightBlockHeaders
maxZipCentralDirectoryBytes
maxZipCommentBytes
maxZipEocdSearchBytes
maxBzip2BlockSize
```

These reader limits are distinct from `ExtractOptions.maxEntryBytes` and `maxTotalExtractedBytes`, which `dir-archiver` enforces while materializing regular files.

## write

```ts
write(source: string, destination: string, options?: WriteOptions): Promise<WriteResult>
```

```js
const result = await write("./project", "./artifacts/project.zip", {
  format: "zip",
  includeBaseDirectory: true,
  exclude: ["node_modules", ".git", "build/debug.log"],
});
```

`WriteResult` contains `format`, absolute `source`, absolute `destination`, `entryCount`, and `wrappedDirectoryCodec`.

### Write options

| Option | Default | Meaning |
| --- | --- | --- |
| `format` | inferred, then `zip` | Force the output format. |
| `includeBaseDirectory` | `false` | Prefix directory entries with the source directory name. |
| `followSymlinks` | `false` | Follow links found while walking a directory source. |
| `exclude` | `[]` | Skip matching basenames or exact source-relative paths. |
| `profile` | reserved | Present in the type but not forwarded in v3. |
| `limits` | reserved | Present in the type but not forwarded in v3. |

For one regular-file source, the archive path is the source basename. `includeBaseDirectory`, `exclude`, and `followSymlinks` affect directory traversal and do not filter or rename that single file.

`followSymlinks` controls links discovered while walking a directory. It does not provide a containment guarantee for a top-level source path; avoid a top-level symlink when source-root containment matters.

### Include the source directory

Given `project/package.json` and `project/src/index.js`, `includeBaseDirectory: true` writes:

```txt
project/package.json
project/src/index.js
```

The default writes:

```txt
package.json
src/index.js
```

### Exclude source paths

A value without a path separator matches that basename anywhere below the source root. A value with a separator matches one exact source-relative path.

```js
await write("./project", "./artifacts/project.zip", {
  exclude: [
    "node_modules",
    ".git",
    "build/debug.log",
  ],
});
```

Exclusions are not globs. `"*.log"` and `"build/**"` do not expand. Matching is case-insensitive on Windows.

An absolute exclusion is converted to a relative match only when it resolves inside the source tree. An absolute path equal to the source root or outside it does not match relative traversal paths.

### Write side effects

- The destination parent is created when needed.
- The destination is opened before every source file has been processed.
- An existing destination can be replaced before a later failure.
- A failure can leave a partial destination.
- Each source file is read fully into memory before it is added.
- Empty source directories and source filesystem metadata are not preserved.
- Links encountered during a directory walk are skipped by default.
- With `followSymlinks: true`, linked content can come from outside the source root.
- Traversal and emitted paths are lexicographically ordered, but byte-identical output also depends on the writer, codec, runtime, and dependency version.

Keep the destination outside the source tree. For publication, write to a temporary sibling and rename only after success. See [A write replaced the previous destination before failing](troubleshooting.md#a-write-replaced-the-previous-destination-before-failing).

### Directory codecs

Directory requests for bare codecs are mapped before writer capability is checked:

| Request | Mapped format | Current result |
| --- | --- | --- |
| `gz` | `tar.gz` | Supported on Node.js, Bun, and Deno. |
| `zst` | `tar.zst` | Supported on Node.js and Bun; capability-gated on Deno. |
| `br` | `tar.br` | Supported on Node.js and Bun; capability-gated on Deno. |
| `bz2` | `tar.bz2` | Mapped, then rejected by the current writer. |
| `xz` | `tar.xz` | Mapped, then rejected by the current writer. |

The filename is not rewritten after mapping. Use an extension that describes the emitted format. See [Formats](formats.md).

## detect

```ts
detect(input: DirArchiverInput, options?: OpenOptions): Promise<DetectResult>
```

Resolves a format without enumerating entries.

```js
const result = await detect("./artifact.tar.gz");
console.log(result.format); // "tgz" with current read-side filename inference
```

`DetectResult` contains `format` and optional bytefold `detection` metadata.

Current read-side filename inference maps both `.tgz` and `.tar.gz` to `tgz`. An explicit `format: "tar.gz"` preserves `tar.gz`. `write()` destination inference uses `tar.gz` for both suffixes. The identifiers describe the same format family.

Brotli input requires `filename` or `format` when the input supplies no usable filename.

## list

```ts
list(input: DirArchiverInput, options?: OpenOptions): Promise<ListResult>
```

```js
const result = await list("./artifact.zip");

for (const entry of result.entries) {
  console.log(entry.name, entry.size, entry.isSymlink);
}
```

`ListEntry.size` is a decimal string so large integer values survive JSON serialization. Entry names use `/` separators. `list()` describes contents; it does not approve an archive for extraction.

## audit

```js
const report = await audit("./incoming.zip", {
  profile: "agent",
  limits: {
    maxEntries: 5_000,
    maxTotalUncompressedBytes: 1024 * 1024 * 1024,
  },
});

if (!report.ok) {
  console.error(report.issues);
}
```

A completed audit returns a report even when it contains error-severity issues. Inspect `report.ok`. The report contains `schemaVersion`, `ok`, `summary`, and `issues`; nested issue fields are produced by bytefold.

Current profile behavior:

- `strict` uses strict parsing and default bytefold limits; symlink presence is normally a warning.
- `agent` uses tighter limits and currently treats symlink presence as an error.
- `compat` relaxes reader and audit policy, but wrapper path and link checks still apply if `extract()` is called later.

Strict `extract()` already audits before archive entries are written. Call `audit()` separately when the application needs the report before deciding whether to extract.

## extract

```ts
extract(
  input: DirArchiverInput,
  destination: string,
  options?: ExtractOptions,
): Promise<ExtractResult>
```

```js
const result = await extract("./incoming.zip", "./staging/extracted", {
  profile: "strict",
  maxEntryBytes: 64 * 1024 * 1024,
  maxTotalExtractedBytes: 512 * 1024 * 1024,
});
```

| Option | Default | Meaning |
| --- | --- | --- |
| `profile` | `strict` | Reader defaults and pre-extraction audit policy. |
| `allowSymlinks` | `false` | Materialize permitted symlink entries instead of skipping them. |
| `allowHardlinks` | `false` | Reserved; hard links are rejected in v3. |
| `maxEntryBytes` | unset | Maximum bytes for one materialized regular file. |
| `maxTotalExtractedBytes` | unset | Maximum aggregate materialized regular-file bytes. |

`ExtractResult` contains `format`, absolute `destination`, completed file and directory-entry counts, `skippedEntries`, and audit issues collected by strict or agent extraction.

Profile enforcement:

- `strict` audits before archive entries are written and rejects an unsafe report.
- `agent` calls `assertSafe()` and then audits. Current agent policy rejects symlink presence even when `allowSymlinks` is true.
- `compat` skips the pre-extraction audit but retains lexical containment, link policy, and explicit materialization limits.

Extraction is not transactional. The destination is created before the strict or agent audit, matching files are replaced, each regular file is buffered in memory, and a later failure can leave earlier output.

For external input, use a new staging directory under a trusted parent, remove it after any failure, and publish it only after success. See [Safety](safety.md#recommended-extraction-flow).

## normalize

```ts
normalize(
  input: DirArchiverInput,
  destination: string,
  options?: NormalizeOptions,
): Promise<NormalizeResult>
```

```js
const result = await normalize("./incoming.zip", "./staging/normalized.zip", {
  profile: "strict",
  deterministic: true,
});
```

`deterministic` defaults to `true`. Normalization preserves the opened source format; the destination extension does not convert formats.

Use a destination different from the input. The destination is opened before normalization finishes, so a failure can leave a partial file. Normalize to a temporary sibling and publish it only after success.

Bare `gz`, `bz2`, `xz`, `zst`, and `br` inputs do not support normalization in the current Node.js/Bun matrix. Deno has additional codec restrictions. Missing reader support causes `DIRARCHIVER_NORMALIZE_UNSUPPORTED`.

## open

`open()` returns the lower-level bytefold reader. Prefer the higher-level operations unless direct entry streams or reader methods are required.

Use in-memory input in portable examples because the public reader type has no cross-runtime lifecycle method:

```js
const reader = await open(archiveBytes, {
  filename: "artifact.zip",
  profile: "strict",
});

console.log(reader.format);
for await (const entry of reader.entries()) {
  console.log(entry.name);
}
```

The reader exposes `format`, optional `detection`, `entries()`, `audit()`, `assertSafe()`, and optional `normalizeToWritable()`.

The public type does not define `close()` or `dispose()`. Do not call undocumented lifecycle hooks in cross-runtime code. `detect()`, `list()`, `audit()`, and `normalize()` manage their reader operation internally.

The CLI `open` command is different: it serializes format and detection metadata rather than exposing a reader object.

## Errors

Known package-policy failures use `DirArchiverError`:

```js
try {
  await extract("./incoming.zip", "./staging/out", {
    profile: "strict",
  });
} catch (error) {
  if (error instanceof DirArchiverError) {
    console.error(error.code, error.context);
  } else {
    // Filesystem, network, cancellation, parser, and codec failures are not
    // all converted into DirArchiverError.
    throw error;
  }
}
```

Stable package code names:

```txt
DIRARCHIVER_INVALID_SOURCE
DIRARCHIVER_INVALID_DESTINATION
DIRARCHIVER_PATH_TRAVERSAL
DIRARCHIVER_UNSUPPORTED_ENTRY
DIRARCHIVER_RESOURCE_LIMIT
DIRARCHIVER_RUNTIME_UNSUPPORTED
DIRARCHIVER_NORMALIZE_UNSUPPORTED
DIRARCHIVER_USAGE
```

The source and destination validation codes are part of the stable union, although some current filesystem failures still surface as native errors. Branch on `code`, not message text. `toJSON()` returns `schemaVersion`, `name`, `code`, `message`, and optional `hint` and `context`.

## Contract boundaries

The wrapper operation names, package error-code names, and documented top-level result fields are governed by [CONTRACT.md](../CONTRACT.md). Bytefold-owned reports and runtime capabilities remain versioned dependency surfaces.
