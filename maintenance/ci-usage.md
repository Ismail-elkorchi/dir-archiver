# Maintainer: use dir-archiver in CI pipelines

This page is for repository maintainers and release automation. Consumer-facing CLI docs live in [docs/cli.md](../docs/cli.md).

## Goal

Normalize incoming archives and gate releases with deterministic audit results.

## Prerequisites

- `dir-archiver` is available in the CI job.
- The job has an input archive path from the build pipeline.
- The job captures stdout and stderr separately when using `--json`.

## Normalize

```sh
dir-archiver normalize \
  --input ./incoming.zip \
  --output ./normalized.zip \
  --profile strict \
  --json
```

## Audit gate

```sh
dir-archiver audit \
  --input ./incoming.zip \
  --profile agent \
  --json
```

## Expected behavior

- Normalize emits a JSON report with deterministic summary fields when the input format supports normalization.
- Audit exits with code `0` when the archive passes the requested profile checks.
- Audit exits with code `1` when an archive-policy failure occurs.
- Usage mistakes exit with code `2`.

## Common mistakes

- Treating exit code `2` as an archive-safety failure instead of a command usage error.
- Extracting or normalizing untrusted input before audit.
- Dropping JSON output before later stages can inspect it.

## Related docs

- [CLI guide](../docs/cli.md)
- [Safety](../docs/safety.md)
- [Public contract](../CONTRACT.md)
