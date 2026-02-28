---
role: contract
audience: maintainers, contributors, users
source_of_truth: docs/V3_CONTRACT.md
update_triggers:
  - public API changes
  - format support changes
  - security-profile behavior changes
---

# dir-archiver v3 contract

This document is the source of truth for `dir-archiver` v3 behavior.

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

Profiles are passed through to bytefold (`compat | strict | agent`).

## Format surface

v3 accepts the full bytefold `ArchiveFormat` union:

`zip`, `tar`, `tgz`, `tar.gz`, `gz`, `bz2`, `tar.bz2`, `zst`, `tar.zst`, `br`, `tar.br`, `xz`, `tar.xz`.

### Directory input with single-file codec

When `write()` receives a directory source and the requested format is a single-file codec:

- `gz` → `tar.gz`
- `bz2` → `tar.bz2`
- `xz` → `tar.xz`
- `zst` → `tar.zst`
- `br` → `tar.br`

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

Consumers must rely on `DirArchiverError.code`, not message text.
Current stable codes:

- `DIRARCHIVER_INVALID_SOURCE`
- `DIRARCHIVER_INVALID_DESTINATION`
- `DIRARCHIVER_PATH_TRAVERSAL`
- `DIRARCHIVER_UNSUPPORTED_ENTRY`
- `DIRARCHIVER_RESOURCE_LIMIT`
- `DIRARCHIVER_RUNTIME_UNSUPPORTED`
- `DIRARCHIVER_NORMALIZE_UNSUPPORTED`
- `DIRARCHIVER_USAGE`

## API surface snapshot oracle

`test/api-snapshot.test.mjs` compares module exports with
`test/fixtures/api-surface.v3.json`.
Any intentional API change must update both the contract and snapshot.
