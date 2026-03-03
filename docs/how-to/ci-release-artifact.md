# How-to: create a CI release artifact

## Goal
Produce a release ZIP in CI and emit a machine-readable JSON summary.

## Prereqs
- Node `>=24`
- `npm install`
- `npm run build`

## Copy/paste
Minimal CI shell snippet:

```sh
node examples/ci-release-artifact.mjs
```

Equivalent CLI flow:

```sh
dir-archiver write --source ./dist --output ./release.zip --include-base-directory --json
dir-archiver detect --input ./release.zip --json
```

## What you should see
- JSON output containing `artifact`, `format`, and `entryCount`.
- `format` is `zip` when the destination extension is `.zip`.

## Safety notes
> [!NOTE]
> Keep `--json` enabled in CI so build steps can parse deterministic fields
> instead of scraping human-readable text.
