# dir-archiver v3 contract

This document defines the stability boundary for `dir-archiver` v3. It is intentionally compact: learning material and operational guidance live in the [documentation](docs/index.md).

## Distribution

- The package is ESM-only.
- The API supports Node.js `>=24`, current Bun, and current Deno.
- npm publishes the API and the Node.js `dir-archiver` executable.
- JSR publishes the API, not the CLI executable.

## Stable package surface

The named API operations are:

- `open(input, options?)`
- `detect(input, options?)`
- `list(input, options?)`
- `audit(input, options?)`
- `extract(input, destination, options?)`
- `normalize(input, destination, options?)`
- `write(source, destination, options?)`

The default export mirrors those operations and adds no behavior.

The CLI command names are:

- `write`
- `open`
- `detect`
- `list`
- `audit`
- `extract`
- `normalize`

## Wrapper-owned and dependency-owned data

The operation names, package error-code names, and documented top-level wrapper result fields are controlled by `dir-archiver`.

Detection, audit, and normalization reports are produced by bytefold. Those reports carry their own `schemaVersion`; consumers that persist or parse them must store and check that version. Dependency updates can add report findings or change runtime capabilities without changing the wrapper operation names.

## Inputs and outputs

Read operations accept local paths, HTTP or HTTPS URLs, `URL`, `Uint8Array`, `ArrayBuffer`, `ReadableStream<Uint8Array>`, and `Blob`, subject to runtime permissions and adapter capabilities.

`write()` accepts local source and destination paths. `extract()` writes to a local directory. `normalize()` writes to a local archive path.

## Profiles and formats

The public profile names are stable:

- `compat`
- `strict`
- `agent`

The public format identifiers are stable:

```txt
zip, tar, tgz, tar.gz, gz, bz2, tar.bz2, zst, tar.zst, br, tar.br, xz, tar.xz
```

A valid format identifier does not guarantee that every operation is available on every runtime. The current matrix is documented in [Formats](docs/formats.md).

`tgz` and `tar.gz` identify the same format family. Consumers must not rely on an inferred read result preserving one alias spelling. Current read operations report gzip-compressed TAR as `tgz`; current writer inference and explicit writer requests can report `tar.gz` or `tgz`.

## `write()` guarantees

- The destination format is inferred from its extension and falls back to `zip` when no supported extension is recognized.
- Directory traversal and emitted archive paths are lexicographically ordered and use `/` separators.
- `includeBaseDirectory` defaults to `false`.
- Links encountered while walking a directory source are skipped unless `followSymlinks` is `true`.
- `exclude` uses basename or exact source-relative matching; wildcard syntax is not expanded.
- A single regular-file source is stored under its basename; directory-only traversal options do not filter or rename that file.
- `followSymlinks` controls directory traversal and is not a source-containment guarantee for a top-level path.
- `entryCount` counts emitted file entries.
- Empty source directories and source filesystem metadata are not preserved by the directory wrapper.
- Directory requests for `gz`, `bz2`, `xz`, `zst`, and `br` are mapped to the corresponding TAR-based format before writer capability is checked.
- `WriteOptions.profile` and `WriteOptions.limits` are reserved and are not forwarded in v3.

Writing is not transactional. The destination can be created or replaced before all source files have been processed, and a failure can leave partial output. A destination inside the source tree can be discovered during traversal. Consumers should write to a separate temporary path and publish only after success when replacement safety matters.

## `extract()` guarantees

- The default extraction profile is `strict`.
- Strict and agent extraction perform a pre-extraction audit before archive entries are written.
- Empty, absolute, drive-prefixed, traversal, and lexically out-of-root entry paths are rejected.
- Symlinks are skipped unless `allowSymlinks` is `true` and their target passes wrapper path checks.
- Hard links are rejected in v3 regardless of `allowHardlinks`.
- `maxEntryBytes` and `maxTotalExtractedBytes` are enforced while regular files are materialized.
- The result reports the absolute destination, completed file and directory counts, skipped-entry count, and collected audit issues.

Extraction is not transactional. The destination is created before the strict or agent audit, matching files are replaced, and a later failure can leave earlier output in place. Lexical containment does not make a pre-existing destination with symlinked path components safe. Use a new staging directory under a trusted parent as described in [Safety](docs/safety.md).

## `normalize()` guarantees

- Deterministic normalization is requested by default.
- The destination suffix does not select a conversion.
- `NormalizeResult.format` identifies the opened source reader, not necessarily the emitted byte format.
- Output bytes and operation availability are delegated to the active bytefold reader.
- A reader without normalization support causes `DIRARCHIVER_NORMALIZE_UNSUPPORTED`.

Normalization is not transactional and can leave a partial destination after failure. The current bytefold `0.8.x` output matrix, including layered-TAR output, is documented in [Formats](docs/formats.md) and is a dependency-owned capability rather than an alias-preservation guarantee.

## Error contract

Consumers should branch on `DirArchiverError.code`, not message text.

Stable v3 package code names are:

- `DIRARCHIVER_INVALID_SOURCE`
- `DIRARCHIVER_INVALID_DESTINATION`
- `DIRARCHIVER_PATH_TRAVERSAL`
- `DIRARCHIVER_UNSUPPORTED_ENTRY`
- `DIRARCHIVER_RESOURCE_LIMIT`
- `DIRARCHIVER_RUNTIME_UNSUPPORTED`
- `DIRARCHIVER_NORMALIZE_UNSUPPORTED`
- `DIRARCHIVER_USAGE`

`DirArchiverError.toJSON()` always includes `schemaVersion`, `name`, `code`, and `message`, with optional `hint` and `context`.

Not every filesystem, network, cancellation, parser, or codec failure is converted into `DirArchiverError`. Consumers must also handle other error types.

## CLI exit and stream contract

- Exit `0`: the command completed and emitted its result.
- Exit `1`: an operational failure prevented a result.
- Exit `2`: CLI usage or validation failed.

A completed `audit` command exits `0` even when its report has `ok: false`; automation must inspect the report.

With `--json`:

- successful results are JSON on stdout;
- usage failures are `DIRARCHIVER_USAGE` JSON on stdout;
- known `DirArchiverError` failures are JSON on stderr;
- other exit-`1` failures can be non-JSON diagnostics on stderr.

Human-readable output is not a stable machine interface. See the [CLI guide](docs/cli.md) for command and automation details.

## Compatibility checks

`test/api-snapshot.test.mjs` compares public exports with `test/fixtures/api-surface.v3.json`. Intentional export changes update both the snapshot and this contract.
