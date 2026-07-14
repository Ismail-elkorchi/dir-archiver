# dir-archiver contract

This document defines the stability boundary for `dir-archiver` v3. Learning material and operational guidance live in [`docs/`](docs/index.md).

## Published surfaces

### API

- ESM-only package.
- Node.js `>=24` through npm.
- Current Bun through npm.
- Current Deno through JSR.
- Named operations and a default namespace export.

### CLI

- Node.js executable shipped in the npm package as `dir-archiver`.
- The JSR package does not publish the CLI executable.
- CLI commands: `write`, `open`, `detect`, `list`, `audit`, `extract`, and `normalize`.

## Public API operations

- `open(input, options?)`
- `detect(input, options?)`
- `list(input, options?)`
- `audit(input, options?)`
- `extract(input, destination, options?)`
- `normalize(input, destination, options?)`
- `write(source, destination, options?)`

The default export mirrors those operation exports and does not add behavior.

## Read inputs

Read operations accept:

- local path strings;
- HTTP or HTTPS URL strings;
- `URL` objects;
- `Uint8Array`;
- `ArrayBuffer`;
- `ReadableStream<Uint8Array>`;
- `Blob`.

Availability of filesystem and network input depends on runtime permissions and adapter capabilities. `write()` accepts local source and destination path strings.

## Profiles

Public profile names are stable:

- `compat`
- `strict`
- `agent`

Read, audit, extract, and normalize flows pass profile and reader-limit options to bytefold.

`extract()` defaults to `strict` when no profile is supplied.

Current wrapper behavior:

- `strict` audits before archive entry writes and rejects a report containing error-severity issues;
- `agent` calls `assertSafe()` and then audits before archive entry writes;
- `compat` skips the wrapper's pre-extraction audit;
- every profile still uses wrapper destination-containment checks, hard-link rejection, symlink policy, and explicit materialization byte limits.

Dependency updates can add report findings or adjust profile-owned default limits without changing the public profile names.

## Write contract

`write()`:

- resolves source and destination to absolute local paths;
- infers format from the destination extension, falling back to `zip`;
- replaces an existing destination file;
- creates the destination parent when needed;
- traverses directory sources deterministically;
- sorts emitted file paths lexicographically;
- normalizes archive path separators to `/`;
- writes regular file entries;
- skips source symlinks unless `followSymlinks` is true;
- returns `format`, `source`, `destination`, `entryCount`, and `wrappedDirectoryCodec`.

`entryCount` counts emitted file entries. The directory wrapper does not promise preservation of empty directories or source filesystem metadata.

`exclude` uses exact normalized matches:

- a value without a path separator matches that basename anywhere below the source root;
- a value with a separator matches one exact source-relative path;
- wildcard syntax is not expanded;
- matching is case-insensitive on Windows.

Callers should keep the destination outside the source tree. The implementation opens the destination before walking a directory source, so an output inside the source can be discovered during traversal.

`WriteOptions.profile` and `WriteOptions.limits` are reserved and are not forwarded by `write()` in v3.

## Directory codec mapping

For a directory source, these requested single-file codecs are mapped before writer creation:

- `gz` -> `tar.gz`
- `bz2` -> `tar.bz2`
- `xz` -> `tar.xz`
- `zst` -> `tar.zst`
- `br` -> `tar.br`

The mapping is reported by `wrappedDirectoryCodec`.

The current wrapper rejects writer formats `bz2`, `tar.bz2`, `xz`, and `tar.xz` with `DIRARCHIVER_UNSUPPORTED_ENTRY`. Other write capabilities can still vary by runtime. The current operation matrix is documented in [Formats](docs/formats.md).

## Detect and list contract

`detect()` returns:

- `format`;
- optional dependency-produced `detection` metadata.

`list()` returns:

- `format`;
- optional dependency-produced `detection` metadata;
- `entries` containing `format`, `name`, decimal-string `size`, `isDirectory`, `isSymlink`, and optional `linkName`.

Entry names use `/` separators. Sizes are strings for JSON-safe integer transport.

## Audit contract

`audit()` returns the bytefold audit report. A report can complete successfully with `ok: false`; callers must inspect `ok` when using audit as a policy gate.

The report carries its own `schemaVersion`. Nested issue codes and report fields are dependency-produced rather than `DirArchiverError.code` values.

## Extract contract

`extract()`:

- resolves the destination to an absolute local path;
- creates the destination directory before the strict/agent audit;
- rejects empty, absolute, drive-prefixed, and `..` entry paths;
- verifies lexical containment beneath the destination root;
- creates directory entries;
- buffers each regular file entry before writing it;
- replaces matching destination files;
- skips symlinks unless `allowSymlinks` is true;
- rejects enabled symlink targets that are absolute or contain `..`;
- rejects hard links regardless of `allowHardlinks` in v3;
- enforces `maxEntryBytes` and `maxTotalExtractedBytes` while materializing regular files;
- returns `format`, absolute `destination`, extraction counts, skipped count, and collected audit issues.

Extraction is not transactional. A failure can leave the destination directory, earlier entries, and replaced files on disk. Callers are responsible for staging, cleanup, filesystem isolation, and publishing output after success.

Lexical containment does not make a pre-existing destination tree with symlinked path components safe. Consumer guidance requires a new directory beneath a trusted parent.

## Normalize contract

`normalize()`:

- defaults to deterministic normalization;
- writes the same opened format rather than converting based on destination extension;
- returns source `format` and a dependency-produced versioned `report`;
- throws `DIRARCHIVER_NORMALIZE_UNSUPPORTED` when the reader exposes no normalization operation.

The destination is opened before normalization finishes. Callers should use a path different from the input and remove partial output after failure.

## Low-level reader contract

`open()` returns the current bytefold `ArchiveReader` contract:

- `format`;
- optional `detection`;
- `entries()`;
- `audit()`;
- `assertSafe()`;
- optional `normalizeToWritable()`.

The public reader type does not currently define a cross-runtime `close()` or `dispose()` method.

The CLI `open` command serializes format and detection metadata only; it does not expose a reader object.

## Package error stability

Consumers should branch on `DirArchiverError.code`, not message text.

Stable v3 code names:

- `DIRARCHIVER_INVALID_SOURCE`
- `DIRARCHIVER_INVALID_DESTINATION`
- `DIRARCHIVER_PATH_TRAVERSAL`
- `DIRARCHIVER_UNSUPPORTED_ENTRY`
- `DIRARCHIVER_RESOURCE_LIMIT`
- `DIRARCHIVER_RUNTIME_UNSUPPORTED`
- `DIRARCHIVER_NORMALIZE_UNSUPPORTED`
- `DIRARCHIVER_USAGE`

`DirArchiverError.toJSON()` always includes:

- `schemaVersion: "1"`;
- `name: "DirArchiverError"`;
- `code`;
- `message`;
- optional `hint`;
- optional `context`.

Not every filesystem, network, cancellation, parser, or codec failure is converted into `DirArchiverError`. Consumers must also handle other error types. The source and destination code names remain part of the stable code union even though some current native filesystem failures bypass them.

## CLI exit and stream contract

- Exit `0`: the command completed and emitted its result.
- Exit `1`: an operational failure occurred.
- Exit `2`: CLI usage or validation failed.

Special case: `audit` exits `0` when it successfully emits a report, including a report whose `ok` field is `false`.

With `--json`:

- successful results are JSON on stdout;
- usage failures are `DIRARCHIVER_USAGE` JSON on stdout;
- known `DirArchiverError` operational failures are JSON on stderr;
- other exit-`1` operational failures can be text on stderr.

Without `--json`, success output and diagnostic formatting are for humans and are not a stable machine interface.

Canonical command and flag documentation lives in [docs/cli.md](docs/cli.md).

## Snapshot oracle

`test/api-snapshot.test.mjs` compares module exports with `test/fixtures/api-surface.v3.json`.

An intentional public export change updates this contract and the snapshot. Documentation links and anchors are checked by `test/docs-links.test.mjs`.
