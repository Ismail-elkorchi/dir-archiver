# Maintainer: create a CI release artifact

This page is for repository maintainers and release automation. Consumer-facing release artifact guidance lives in [docs/recipes/create-release-artifact.md](../docs/recipes/create-release-artifact.md).

## Goal

Produce a release ZIP in CI and emit a machine-readable JSON summary.

## Prerequisites

- Node.js `>=24` for repository scripts.
- Dependencies installed with `npm ci`.
- Package built with `npm run build` when using repository-local examples.

## Repository-local example

```sh
node examples/ci-release-artifact.mjs
```

Expected output shape:

```json
{
  "ok": true,
  "artifact": "/tmp/.../release-artifact.zip",
  "format": "zip",
  "entryCount": 2,
  "wrappedDirectoryCodec": false
}
```

## Equivalent CLI flow

```sh
dir-archiver write \
  --source ./dist \
  --output ./release.zip \
  --include-base-directory \
  --json

dir-archiver detect \
  --input ./release.zip \
  --json
```

## Common mistakes

- Omitting `--json`, which forces CI jobs to parse human-readable output.
- Letting the destination extension choose an unintended format.
- Skipping `--include-base-directory`, which makes extracted files land directly in the output root.
- Not listing the archive before publishing when the release pipeline needs a file manifest.

## Related docs

- [Create a release artifact](../docs/recipes/create-release-artifact.md)
- [CLI guide](../docs/cli.md)
- [Public contract](../CONTRACT.md)
