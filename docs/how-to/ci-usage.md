# How-to: use dir-archiver in CI pipelines

## Goal
Normalize incoming archives and gate releases with deterministic audit results.

## Prereqs
- `dir-archiver` available in CI
- Input archive path from build pipeline

## Copy/paste
Normalize:

```sh
dir-archiver normalize \
  --input ./incoming.zip \
  --output ./normalized.zip \
  --profile strict \
  --json
```

Audit gate:

```sh
dir-archiver audit --input ./incoming.zip --profile agent --json
```

## What you should see
- Normalize emits JSON report with deterministic summary fields.
- Audit exits with code `0` when safe and `1` when operational risk is detected.

## Safety notes
> [!NOTE]
> Exit code `2` indicates CLI usage mistakes (missing/invalid flags), not
> archive safety problems.
