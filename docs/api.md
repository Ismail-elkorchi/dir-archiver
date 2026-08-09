# API reference

The package is ESM-only and exports named operations.

```js
import {
  DirArchiverError,
  audit,
  detect,
  extract,
  list,
  normalize,
  write,
} from "dir-archiver";
```

## Inputs and read options

`detect`, `list`, `audit`, `extract`, and `normalize` accept:

```ts
type ArchiveInput =
  | string
  | URL
  | Uint8Array
  | ArrayBuffer
  | ReadableStream<Uint8Array>
  | Blob;
```

`ArchiveInput` is Bytefold's exact input type and is exported by this package.

Their shared `ReadOptions` are:

| Field | Meaning |
| --- | --- |
| `format` | Force an `ArchiveFormat`, use `"auto"`, or omit for detection. |
| `safetyProfile` | `"compatible"`, `"strict"`, or `"untrusted"`; default is `"strict"`. |
| `limits` | Bytefold parser, codec, entry, and audit limits. |
| `signal` | Abort supported work. |
| `password` | Password for encrypted ZIP entries. |
| `filename` | Detection hint for an input without a useful path. |

The exported `ArchiveLimits`, `ArchiveDetectionReport`, `ArchiveIssue`, and
`ArchiveNormalizeReport` types are Bytefold's exact contracts.

## write

```ts
write(
  source: string,
  destination: string,
  options?: WriteOptions
): Promise<WriteResult>
```

```js
const result = await write("./project", "./artifacts/project.tar.gz", {
  format: "tar.gz",
  includeBaseDirectory: true,
  followSymlinks: false,
  exclude: ["node_modules", ".git", "build/debug.log"],
});
```

`format` is limited to `zip`, `tar`, `tgz`, `tar.gz`, `tar.zst`, and
`tar.br`. It is inferred from a supported destination suffix and otherwise
defaults to ZIP.

An exclusion without a path separator matches that basename anywhere. An
exclusion with a separator matches one source-relative path. Empty, absolute,
and parent-traversing exclusions are rejected. A trailing separator denotes
that exact source-relative directory. Globs are not expanded. A single-file
source is stored under its basename.

The result contains `format`, absolute `source`, absolute `destination`, and
`entryCount`.

The implementation collects entries before creating the destination, emits
files in JavaScript string order, and buffers each file before adding it. It
does not preserve empty directories or filesystem metadata.

`followSymlinks: true` can include targets outside the source directory. Use it
only with a trusted filesystem layout.

## detect

```ts
detect(input, options?: ReadOptions): Promise<DetectResult>
```

Returns `format` and Bytefold's `detection` report when available.

```js
const result = await detect(upload, { filename: "upload.tar.xz" });
```

## list

```ts
list(input, options?: ReadOptions): Promise<ListResult>
```

Returns the detected format and JSON-safe entries. `sizeInBytes` is a decimal
string so large `bigint` values are preserved.

## audit

```ts
audit(input, options?: ReadOptions): Promise<ArchiveAuditReport>
```

```js
const report = await audit(input, { safetyProfile: "untrusted" });
if (!report.isSafe) {
  console.error(report.issues);
}
```

The report contains `isSafe`, `summary`, and `issues`. A completed audit
returns its report even when the selected profile rejects the archive.

## extract

```ts
extract(
  input,
  destination: string,
  options?: ExtractOptions
): Promise<ExtractResult>
```

In addition to `ReadOptions`, extraction accepts:

| Field | Default | Meaning |
| --- | --- | --- |
| `allowSymlinks` | `false` | Materialize safe relative symlinks. |
| `maxExtractedFileBytes` | unset | Limit one materialized regular file. |
| `maxTotalExtractedBytes` | unset | Limit all materialized regular files. |

Extraction audits with the selected profile before creating the destination.
It rejects an unsafe report, traversal paths, hard links, and enabled symlink
targets that are absolute or contain `..`.

The result contains `format`, absolute `destination`, `extractedFileCount`,
`extractedDirectoryCount`, `extractedSymlinkCount`, `skippedEntryCount`, and
`issues`.

## normalize

```ts
normalize(
  input,
  destination: string,
  options?: NormalizeOptions
): Promise<NormalizeResult>
```

`isDeterministic` defaults to true. The destination suffix does not select a
conversion. `NormalizeResult.format` identifies the source reader; layered TAR
readers currently write the normalized inner TAR.

If the reader cannot normalize, the operation throws
`DIRARCHIVER_NORMALIZE_UNSUPPORTED`.

## Errors

Package policy failures are `DirArchiverError` instances:

```js
try {
  await extract(input, destination, options);
} catch (error) {
  if (error instanceof DirArchiverError) {
    console.error(error.code, error.context);
  } else {
    throw error;
  }
}
```

Filesystem, network, cancellation, and Bytefold failures can surface directly.
Stable package codes are:

- `DIRARCHIVER_PATH_TRAVERSAL`
- `DIRARCHIVER_UNSUPPORTED_ENTRY`
- `DIRARCHIVER_RESOURCE_LIMIT`
- `DIRARCHIVER_NORMALIZE_UNSUPPORTED`

`DirArchiverError.toJSON()` returns schema version `1`, name, code, message,
and optional hint and context.
