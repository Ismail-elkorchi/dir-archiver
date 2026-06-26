# dir-archiver contract

This document defines the current public behavior contract for `dir-archiver`.

Use this file for stability expectations. Use the user guides for learning and examples:

- [API guide](docs/api.md)
- [CLI guide](docs/cli.md)
- [Safety](docs/safety.md)
- [Formats](docs/formats.md)
- [Troubleshooting](docs/troubleshooting.md)

## Runtime support

- Node.js `>=24`.
- Current stable Deno.
- Current stable Bun.
- Package format is ESM-only.

## Public operations

The public API exposes these operations:

- `open(input, options)`
- `detect(input, options)`
- `list(input, options)`
- `audit(input, options)`
- `extract(input, destination, options)`
- `normalize(input, destination, options)`
- `write(source, destination, options)`

The default export mirrors the named operation exports.

Profiles are passed through to bytefold for read, audit, extract, and normalize flows: `compat`, `strict`, and `agent`.

`WriteOptions.profile` and `WriteOptions.limits` are currently reserved and not forwarded by `write()`.

## Format surface

The package accepts the full bytefold `ArchiveFormat` union:

```txt
zip, tar, tgz, tar.gz, gz, bz2, tar.bz2, zst, tar.zst, br, tar.br, xz, tar.xz
```

Operation-level support notes live in [docs/formats.md](docs/formats.md).

### Directory input with single-file codec

When `write()` receives a directory source and the requested format is a single-file codec, the requested format is converted before writing:

- `gz` -> `tar.gz`
- `bz2` -> `tar.bz2`
- `xz` -> `tar.xz`
- `zst` -> `tar.zst`
- `br` -> `tar.br`

This conversion is deterministic and reported via `WriteResult.wrappedDirectoryCodec`.

## Determinism rules

- Directory traversal order is lexicographic and stable.
- Archive entry paths are normalized to `/`.
- `normalize()` defaults to deterministic mode with `isDeterministic: true`.

## Resource limits

Extraction limits are explicit options:

- `maxEntryBytes`
- `maxTotalExtractedBytes`

Budget overruns fail with stable code `DIRARCHIVER_RESOURCE_LIMIT`.

## Security model

- Extraction treats archive entries as untrusted unless callers explicitly decide otherwise.
- Absolute paths, drive-prefixed paths, and traversal (`..`) are rejected with `DIRARCHIVER_PATH_TRAVERSAL`.
- Strict and agent extraction run an audit gate before writing files.
- Hard links are rejected with `DIRARCHIVER_UNSUPPORTED_ENTRY` in current v3 behavior.
- Symlinks are skipped unless explicitly enabled.

Usage guidance lives in [docs/safety.md](docs/safety.md).

## Error code stability

Consumers should rely on `DirArchiverError.code`, not message text.

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
- `2`: usage or validation failure

Canonical command, flag, JSON, and stream behavior is documented in [docs/cli.md](docs/cli.md).

## API surface snapshot oracle

`test/api-snapshot.test.mjs` compares module exports with `test/fixtures/api-surface.v3.json`.

Any intentional API change updates both this contract and the snapshot.
