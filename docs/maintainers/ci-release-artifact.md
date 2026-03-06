# Maintainer how-to: create a CI release artifact

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
node dist/cli.js write --source ./dist --output ./release.zip --include-base-directory --json
node dist/cli.js detect --input ./release.zip --json
```

## What you should see
- JSON output containing `artifact`, `format`, and `entryCount`.
- `format` is `zip` when the destination extension is `.zip`.

## Common failure modes
- `--json` is omitted, so CI jobs have to scrape human-readable output.
- The destination extension does not match the intended format, so inference
  chooses the wrong archive type.
- `--include-base-directory` is skipped and extracted files do not land under a
  stable root folder.

## Related reference
- [CLI reference](../reference/cli.md)
- [Options reference](../reference/options.md)
- [Contract](../reference/contract.md)
