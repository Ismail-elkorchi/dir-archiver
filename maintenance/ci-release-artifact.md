# Create a CI release artifact

This repository-maintainer runbook creates a ZIP from build output and verifies its inventory before publication.

## Prepare the repository

```sh
npm ci
npm run build
```

The checked example uses temporary local files and removes them after completion:

```sh
node examples/ci-release-artifact.mjs
```

Expected fields include:

```json
{
  "ok": true,
  "artifact": "/temporary/path/release-artifact.zip",
  "format": "zip",
  "entryCount": 2,
  "wrappedDirectoryCodec": false
}
```

The temporary artifact path no longer exists after the example exits; the example verifies behavior rather than producing a publishable file.

## Create a real artifact

Keep the destination outside `./dist` so the output cannot be discovered as a source file.

```sh
mkdir -p ./artifacts
node dist/cli.js write --source ./dist --output ./artifacts/release.zip --format zip --include-base-directory --json > ./artifacts/release-summary.json
```

`includeBaseDirectory` stores entries under `dist/`. Omit it when release consumers expect files at the archive root.

## Verify the inventory

```sh
node dist/cli.js list --input ./artifacts/release.zip --json > ./artifacts/release-entries.json
```

Review or gate on the entry names before publication. `write()` includes regular files, skips symlinks by default, and does not preserve empty directories or source filesystem metadata.

## Determinism boundary

Directory traversal and emitted archive paths are deterministic and lexicographically ordered. That does not by itself promise byte-identical output across every writer version, codec implementation, or runtime.

When a supported format needs normalized output, normalize to a temporary file and rename after success:

```sh
node dist/cli.js normalize --input ./artifacts/release.zip --output ./artifacts/release.normalized.zip.tmp --profile strict --json > ./artifacts/normalize-summary.json
mv ./artifacts/release.normalized.zip.tmp ./artifacts/release.normalized.zip
```

ZIP supports normalization in the current runtime matrix. The `mv` command assumes a POSIX runner and a final path that does not already exist; adapt publication semantics to the CI platform.

## Common mistakes

- Writing the archive inside the source directory.
- Assuming `entryCount` includes empty directories.
- Assuming source modes and timestamps are preserved.
- Parsing human console output instead of using `--json`.
- Merging stdout and stderr before JSON parsing.
- Publishing without checking the archive inventory.
- Calling a deterministic traversal result byte-identical without normalization and a pinned toolchain.
- Normalizing directly over the source archive.

## Related documentation

- [API: write](../docs/api.md#write)
- [CLI: write](../docs/cli.md#write)
- [Formats](../docs/formats.md)
- [Safety](../docs/safety.md)
- [Public contract](../CONTRACT.md)
