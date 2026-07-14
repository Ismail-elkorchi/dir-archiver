# API guide

This page is the canonical guide for the programmatic `dir-archiver` surface.

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

`deno add` records the JSR package in the project import map. A direct `jsr:@ismail-elkorchi/dir-archiver` import is also valid without an import-map entry.

A default namespace export mirrors the named operation exports:

```js
import dirArchiver from "dir-archiver";

await dirArchiver.write("./project", "./project.zip");
```

The package is ESM-only.

## Exported types and dependency-owned results

`dir-archiver` exports its option and wrapper-result types, including `OpenOptions`, `ExtractOptions`, `WriteOptions`, `DetectResult`, `ListResult`, `ExtractResult`, `NormalizeResult`, `ArchiveFormat`, `ArchiveProfile`, and `DirArchiverErrorCode`.

The return types of `open()` and `audit()` are owned by bytefold and are not re-exported as named `dir-archiver` types. Let TypeScript infer them, or create a local alias:

```ts
import { audit, open } from "dir-archiver";

type OpenedArchive = Awaited<ReturnType<typeof open>>;
type AuditReport = Awaited<ReturnType<typeof audit>>;
```

Dependency-owned detection, audit, and normalization payloads carry their own `schemaVersion`. Do not assume every nested field is part of the wrapper's stable result contract.

## Inputs

Read operations accept these public input shapes:

```ts
type DirArchiverInput =
  | string
  | URL
  | Uint8Array
  | ArrayBuffer
  | ReadableStream<Uint8Array>
  | Blob;
```

A string can be a local path or an HTTP or HTTPS URL. A `URL` can be a file URL or network URL when the active runtime adapter supports it. Network inputs require the runtime's network permission and can fail with network-specific errors.

For bytes, a stream, or a `Blob`, pass a filename hint when the format cannot be determined from magic bytes alone:

```js
const result = await detect(uploadBytes, {
  filename: "upload.tar.br",
});
```

An explicit `format` is stronger than a filename hint:

```js
const result = await detect(uploadBytes, {
  format: "tar.br",
});
```

## Shared read options

`open()`, `detect()`, `list()`, `audit()`, `extract()`, and `normalize()` accept `OpenOptions`. Extraction and normalization add their own fields.

| Option | Current default | Meaning |
| --- | --- | --- |
| `format` | `"auto"` | Force an archive format instead of detecting it. |
| `filename` | unset | Supply an extension hint for bytes, streams, blobs, or URLs. |
| `profile` | `"strict"` in current readers | Select `compat`, `strict`, or `agent` policy defaults. |
| `isStrict` | profile-driven | Override parser strictness. This is an advanced bytefold control, not a replacement for the profile. |
| `limits` | profile-driven limits | Set parser, decompression, entry, or audit ceilings. |
| `signal` | unset | Cancel supported read, audit, or normalization work. |
| `password` | unset | Supply a password for encrypted ZIP members where supported. |

Common fields accepted inside `limits` by the current bytefold `0.8.x` dependency include:

| Limit | Purpose |
| --- | --- |
| `maxInputBytes` | Maximum raw bytes read from the source. |
| `maxEntries` | Maximum archive entries processed. |
| `maxUncompressedEntryBytes` | Maximum declared or observed uncompressed bytes for one entry. |
| `maxTotalUncompressedBytes` | Maximum uncompressed bytes across entries. |
| `maxTotalDecompressedBytes` | Maximum bytes produced by a decompression pipeline. |
| `maxCompressionRatio` | Maximum accepted expansion ratio. |
| `maxDictionaryBytes` | Generic codec dictionary ceiling. |
| `maxXzDictionaryBytes` | XZ dictionary ceiling. |
| `maxXzBufferedBytes` | XZ buffered-input ceiling. |
| `maxXzIndexRecords` | Maximum XZ index records. |
| `maxXzIndexBytes` | Maximum XZ index bytes. |
| `maxXzPreflightBlockHeaders` | Maximum XZ block headers scanned during preflight. |
| `maxZipCentralDirectoryBytes` | Maximum ZIP central-directory bytes. |
| `maxZipCommentBytes` | Maximum ZIP comment bytes. |
| `maxZipEocdSearchBytes` | Maximum bytes searched for ZIP end-of-central-directory data. |
| `maxBzip2BlockSize` | Maximum accepted BZip2 block-size level. |

These reader limits differ from `ExtractOptions.maxEntryBytes` and `maxTotalExtractedBytes`, which are enforced by `dir-archiver` while materializing files.

## write

```ts
write(
  source: string,
  destination: string,
  options?: WriteOptions,
): Promise<WriteResult>
```

Creates an archive from one local file or a local directory.

```js
const result = await write("./project", "./artifacts/project.zip", {
  format: "zip",
  includeBaseDirectory: true,
  exclude: ["node_modules", ".git", "build/debug.log"],
});

console.log(result);
```

`WriteResult` contains:

| Field | Meaning |
| --- | --- |
| `format` | Format passed to the active writer after any directory wrapping. |
| `source` | Absolute source path. |
| `destination` | Absolute output path. |
| `entryCount` | Number of file entries written. |
| `wrappedDirectoryCodec` | Whether a requested single-file codec was converted to a TAR-based format for a directory source. |

### Write options

| Option | Default | Meaning |
| --- | --- | --- |
| `format` | inferred from destination, then `zip` | Force the output format. |
| `includeBaseDirectory` | `false` | Prefix archived paths with the source directory name. |
| `followSymlinks` | `false` | Follow symlink targets while walking a directory. |
| `exclude` | `[]` | Skip matching basenames or exact source-relative paths. |
| `profile` | reserved | Present in the public type but not forwarded by `write()` in v3. |
| `limits` | reserved | Present in the public type but not forwarded by `write()` in v3. |

### Include the source directory

Given this source:

```txt
project/
  package.json
  src/index.js
```

`includeBaseDirectory: true` writes:

```txt
project/package.json
project/src/index.js
```

The default `false` writes:

```txt
package.json
src/index.js
```

### Exclude source paths

A value without a path separator is a basename match anywhere below the source root. A value containing a separator is an exact path relative to the source root.

```js
await write("./project", "./artifacts/project.zip", {
  exclude: [
    "node_modules",    // every entry whose basename is node_modules
    ".git",            // every entry whose basename is .git
    "build/debug.log", // exactly this source-relative path
  ],
});
```

Exclusions are not glob patterns. `"*.log"` does not match every log file. On Windows, matching is case-insensitive.

An absolute exclusion is converted to a source-relative match only when it points inside the source tree. An absolute path equal to the source root or outside it has no effect because archive traversal supplies relative paths to the matcher.

### Write behavior to plan for

- The destination parent is created when needed.
- The destination is opened and an existing file is replaced before every source file has been read and added.
- A later source or writer failure can leave a partial destination and can destroy the previous archive at that path.
- Keep the destination outside the source tree; otherwise the newly opened output can be encountered during traversal.
- Each source file is read fully into memory before it is added.
- Only file entries are written. Empty directories are not preserved.
- Source mode, ownership, and modification-time metadata are not preserved by the directory wrapper.
- Symlinks are skipped by default.
- With `followSymlinks: true`, target files are stored as regular files and symlinked directories are traversed. Targets can be outside the source root, so enable this only for a trusted source layout.
- Traversal and archive entry ordering are deterministic and lexicographic, but byte-identical output also depends on the selected writer and format.

For publication workflows, write to a temporary sibling and rename it only after success. See [A write replaced the previous destination before failing](troubleshooting.md#a-write-replaced-the-previous-destination-before-failing).

### Directory codecs

A directory cannot be represented by a bare single-file codec. `write()` maps the request to a TAR-based format before asking the runtime writer:

| Request | Mapped format | Current result |
| --- | --- | --- |
| `gz` | `tar.gz` | Supported on Node.js, Bun, and Deno. |
| `zst` | `tar.zst` | Supported on Node.js and Bun; capability-gated on Deno. |
| `br` | `tar.br` | Supported on Node.js and Bun; capability-gated on Deno. |
| `bz2` | `tar.bz2` | Mapping occurs, then the current writer rejects the format. |
| `xz` | `tar.xz` | Mapping occurs, then the current writer rejects the format. |

See [Formats](formats.md) for the complete matrix.

## detect

```ts
detect(input: DirArchiverInput, options?: OpenOptions): Promise<DetectResult>
```

Resolves the format without enumerating entries.

```js
const result = await detect("./artifact.tar.gz");
console.log(result.format); // tgz with bytefold 0.8.x filename inference
console.log(result.detection);
```

`DetectResult.format` is the resolved public format. `detection` is the bytefold report describing input kind, detected layers, confidence, and notes.

For gzip-compressed TAR, read-side filename inference maps both `.tgz` and `.tar.gz` to `tgz`. An explicit `format: "tar.gz"` preserves `tar.gz`. This differs from `write()` destination inference, which reports `tar.gz` for both suffixes. The two identifiers are aliases for the same format family.

Brotli (`br` and `tar.br`) requires `filename` or `format` when the input has no usable filename.

## list

```ts
list(input: DirArchiverInput, options?: OpenOptions): Promise<ListResult>
```

Returns JSON-safe entry summaries without writing files.

```js
const result = await list("./artifact.zip");

for (const entry of result.entries) {
  console.log({
    name: entry.name,
    size: entry.size,
    isDirectory: entry.isDirectory,
    isSymlink: entry.isSymlink,
    linkName: entry.linkName,
  });
}
```

Each `size` is a decimal string, not a JavaScript number, so large integer values survive JSON serialization. Entry names use `/` separators.

`list()` describes entries; it does not make an archive safe to extract. Use `audit()` for a report and strict `extract()` for enforcement.

## audit

```ts
audit(input: DirArchiverInput, options?: OpenOptions): Promise<AuditReport>
```

`AuditReport` above is descriptive shorthand for the inferred bytefold-owned return type; it is not a named export from `dir-archiver`.

`audit()` returns a non-mutating report. A completed audit does not throw merely because the report contains error-severity issues; check `report.ok`.

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

The report contains `schemaVersion`, `ok`, `summary`, and `issues`. Issue codes and nested report fields are produced by bytefold. Persist the report's `schemaVersion` when storing it for later machine processing.

Profile differences that matter to audit:

- `strict` uses strict parsing and default bytefold limits. Symlink presence is normally a warning.
- `agent` uses strict parsing, tighter agent defaults, and treats symlink presence as an error in current bytefold behavior.
- `compat` relaxes parser/audit strictness, but path containment and link policy still apply later in `extract()`.

Strict `extract()` already audits before writing archive entries. Call `audit()` separately when the application needs the report before deciding whether to extract.

## extract

```ts
extract(
  input: DirArchiverInput,
  destination: string,
  options?: ExtractOptions,
): Promise<ExtractResult>
```

Extracts entries into a local destination directory.

```js
const result = await extract("./incoming.zip", "./staging/extracted", {
  profile: "strict",
  maxEntryBytes: 64 * 1024 * 1024,
  maxTotalExtractedBytes: 512 * 1024 * 1024,
});

console.log(result);
```

### Extract options

| Option | Default | Meaning |
| --- | --- | --- |
| `profile` | `strict` | Select pre-extraction audit and reader defaults. |
| `allowSymlinks` | `false` | Materialize permitted symlink entries instead of skipping them. |
| `allowHardlinks` | `false` | Reserved; hard links are rejected regardless of this value in v3. |
| `maxEntryBytes` | unset | Maximum bytes read for one file entry during materialization. |
| `maxTotalExtractedBytes` | unset | Maximum aggregate file bytes written by the operation. |
| Shared read options | varies | Apply format hints, reader limits, cancellation, and passwords. |

`ExtractResult` contains the source `format`, absolute `destination`, counts for extracted files and directory entries, `skippedEntries`, and audit `issues` collected by the strict flow.

### Profile enforcement

- `strict` audits before entry writes and throws when the report is not safe.
- `agent` invokes the reader's `assertSafe()` and then audits before entry writes. In current bytefold behavior, an archive containing symlinks fails the agent gate even when `allowSymlinks` is true.
- `compat` skips the pre-extraction audit in `dir-archiver`. It does not disable lexical destination containment, absolute-path rejection, `..` rejection, hard-link rejection, the default symlink skip, or explicit extraction byte limits.

### Extraction is not transactional

The destination directory is created before the pre-extraction audit. Existing files with matching names are replaced. Each file is buffered in memory and then written. If a later entry fails, earlier directories and files remain.

For untrusted input:

1. choose a trusted parent directory;
2. create a new staging directory beneath it;
3. keep that staging path free of pre-existing symlinked components;
4. extract with strict or agent policy and explicit limits;
5. remove the staging directory on failure;
6. rename or publish it only after success.

See [Safety](safety.md#recommended-extraction-flow) for a complete pattern.

## normalize

```ts
normalize(
  input: DirArchiverInput,
  destination: string,
  options?: NormalizeOptions,
): Promise<NormalizeResult>
```

Rewrites a format through the active reader's deterministic normalization support.

```js
const result = await normalize("./incoming.zip", "./staging/normalized.zip", {
  profile: "strict",
  deterministic: true,
});

console.log(result.report);
```

`deterministic` defaults to `true`. Normalization keeps the opened source format; the destination extension does not convert ZIP to TAR or another format.

Use a destination different from the input. The destination is opened before normalization completes, so a failure can leave a partial file. A common pattern is to normalize to a temporary sibling and rename it after success.

Bare single-file formats (`gz`, `bz2`, `xz`, `zst`, and `br`) do not support normalization in the current Node.js/Bun matrix. Deno has additional capability restrictions. Unsupported normalization throws `DIRARCHIVER_NORMALIZE_UNSUPPORTED`.

## open

```ts
open(input: DirArchiverInput, options?: OpenOptions): Promise<OpenedArchive>
```

`OpenedArchive` above is descriptive shorthand for the inferred bytefold-owned return type; it is not a named export from `dir-archiver`.

Returns the lower-level bytefold reader used by the helper operations.

```js
const reader = await open("./artifact.zip", {
  profile: "strict",
});

for await (const entry of reader.entries()) {
  console.log(entry.name);
}

const report = await reader.audit({ profile: "strict" });
if (!report.ok) {
  console.error(report.issues);
}
```

The public reader contract exposes:

- `format`
- optional `detection`
- `entries()`
- `audit()`
- `assertSafe()`
- optional `normalizeToWritable()`

The current public reader type does not define a portable `close()` or `dispose()` method. Do not call undocumented lifecycle methods in cross-runtime code. Prefer `detect()`, `list()`, `audit()`, and `normalize()` when their higher-level result is enough; those helpers manage the operation internally.

Because `open()` exposes dependency-owned behavior directly, use it only when the higher-level operations cannot express the required flow. The CLI `open` command is different: it prints format and detection metadata, not a live reader.

## Errors

Known package-level policy failures use `DirArchiverError`:

```js
try {
  await extract("./incoming.zip", "./staging/out", {
    profile: "strict",
    maxTotalExtractedBytes: 512 * 1024 * 1024,
  });
} catch (error) {
  if (error instanceof DirArchiverError) {
    console.error(error.code, error.context);
  } else {
    // Filesystem, network, cancellation, and dependency errors are not all
    // converted into DirArchiverError.
    throw error;
  }
}
```

Current stable package code names are:

| Code | Package-level meaning |
| --- | --- |
| `DIRARCHIVER_INVALID_SOURCE` | Reserved code for an invalid source. Some current filesystem failures still surface as native errors. |
| `DIRARCHIVER_INVALID_DESTINATION` | Reserved code for an invalid destination. Some current filesystem failures still surface as native errors. |
| `DIRARCHIVER_PATH_TRAVERSAL` | An archive entry or permitted symlink target failed destination containment checks. |
| `DIRARCHIVER_UNSUPPORTED_ENTRY` | An audit, entry type, link, or writer capability is unsupported by the wrapper policy. |
| `DIRARCHIVER_RESOURCE_LIMIT` | An explicit extraction byte ceiling was exceeded. |
| `DIRARCHIVER_RUNTIME_UNSUPPORTED` | The active runtime adapter is unavailable. |
| `DIRARCHIVER_NORMALIZE_UNSUPPORTED` | The opened reader does not expose normalization. |
| `DIRARCHIVER_USAGE` | CLI usage validation failed. |

Branch on `code`, not message text. `toJSON()` returns the stable package error envelope with `schemaVersion`, `name`, `code`, `message`, and optional `hint` and `context`.

## Contract boundaries

The wrapper's operation names, package error code names, and documented top-level result fields are the `dir-archiver` contract. Detection, audit, and normalization reports are produced by bytefold and carry their own `schemaVersion`. Runtime capability details can change with dependency updates without changing the public format names.

See [CONTRACT.md](../CONTRACT.md) for the compact stability statement.
