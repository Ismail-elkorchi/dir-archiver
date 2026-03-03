# dir-archiver contract

This document defines the current public behavior contract for `dir-archiver`.

## Runtime support

- Node.js LTS (minimum aligned with bytefold `engines.node`).
- Latest stable Deno.
- Latest stable Bun.

## Public operations

- `open(input, options)`
- `detect(input, options)`
- `list(input, options)`
- `audit(input, options)`
- `extract(input, destination, options)`
- `normalize(input, destination, options)`
- `write(source, destination, options)`

Profiles are passed through to bytefold for read/audit/extract/normalize flows (`compat | strict | agent`).
`WriteOptions.profile` and `WriteOptions.limits` are currently reserved and not forwarded by `write()`.

Detailed option fields and examples are maintained in
`docs/reference/options.md`.

## Format surface

The package accepts the full bytefold `ArchiveFormat` union:

`zip`, `tar`, `tgz`, `tar.gz`, `gz`, `bz2`, `tar.bz2`, `zst`, `tar.zst`, `br`, `tar.br`, `xz`, `tar.xz`.

### Directory input with single-file codec

When `write()` receives a directory source and the requested format is a single-file codec:

- `gz` -> `tar.gz`
- `bz2` -> `tar.bz2`
- `xz` -> `tar.xz`
- `zst` -> `tar.zst`
- `br` -> `tar.br`

This conversion is deterministic and reported via `WriteResult.wrappedDirectoryCodec`.

## Determinism rules

- Directory traversal order is lexicographic and stable.
- Archive entry paths are normalized to `/`.
- `normalize()` defaults to deterministic mode (`isDeterministic: true`).

## Resource limits

Extraction limits are explicit options:

- `maxEntryBytes`
- `maxTotalExtractedBytes`

Budget overruns fail with stable code `DIRARCHIVER_RESOURCE_LIMIT`.

## Security model

- Extraction treats archive entries as untrusted.
- Absolute paths, drive-prefixed paths, and traversal (`..`) are rejected with `DIRARCHIVER_PATH_TRAVERSAL`.
- Strict/agent extraction runs an audit gate before writing files.
- Hard links are rejected with `DIRARCHIVER_UNSUPPORTED_ENTRY`.
- Symlinks are skipped unless explicitly enabled.

## Error code stability

Consumers rely on `DirArchiverError.code`, not message text.
Current stable codes:

- `DIRARCHIVER_INVALID_SOURCE`
- `DIRARCHIVER_INVALID_DESTINATION`
- `DIRARCHIVER_PATH_TRAVERSAL`
- `DIRARCHIVER_UNSUPPORTED_ENTRY`
- `DIRARCHIVER_RESOURCE_LIMIT`
- `DIRARCHIVER_RUNTIME_UNSUPPORTED`
- `DIRARCHIVER_NORMALIZE_UNSUPPORTED`
- `DIRARCHIVER_USAGE`

## CLI exit codes

- `0`: success
- `1`: operational failure
- `2`: usage/validation failure

Canonical command/flag documentation lives in `docs/reference/cli.md`.

## API surface snapshot oracle

`test/api-snapshot.test.mjs` compares module exports with
`test/fixtures/api-surface.v3.json`.
Any intentional API change updates both this contract and the snapshot.
