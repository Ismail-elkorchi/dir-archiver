# How-to: use dir-archiver in CI pipelines

## Goal
Normalize incoming archives and gate releases with deterministic audit results.

## Prereqs
- `dir-archiver` available in CI
- Input archive path from build pipeline

## Copy/paste
Normalize:

```sh
node dist/cli.js normalize \
  --input ./incoming.zip \
  --output ./normalized.zip \
  --profile strict \
  --json
```

Audit gate:

```sh
node dist/cli.js audit --input ./incoming.zip --profile agent --json
```

## What you should see
- Normalize emits JSON report with deterministic summary fields.
- Audit exits with code `0` when safe and `1` when operational risk is detected.

## Common failure modes
- Exit code `2` is treated like an archive-safety failure instead of a CLI
  usage mistake.
- Pipelines skip `audit` and extract or normalize untrusted input blindly.
- Jobs do not persist the JSON output, so later stages cannot inspect the exact
  audit or normalize report.

## Related reference
- [CLI reference](../reference/cli.md)
- [Options reference](../reference/options.md)
- [Contract](../../CONTRACT.md)
