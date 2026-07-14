# Use dir-archiver in CI pipelines

This repository-maintainer runbook uses the locally built CLI. Consumer automation guidance lives in [docs/cli.md](../docs/cli.md).

## Prepare the repository CLI

```sh
npm ci
npm run build
```

Invoke the local executable with Node.js:

```sh
node dist/cli.js detect --input ./incoming.zip --json
```

## Audit gate

`audit` exits `0` when it successfully returns a report, including a report with `ok: false`. Persist the report and inspect it explicitly.

Create or reuse a report checker:

```js
import { readFile } from "node:fs/promises";

const report = JSON.parse(await readFile(process.argv[2], "utf8"));

if (!report.ok) {
  console.error(JSON.stringify(report.issues, null, 2));
  process.exitCode = 1;
}
```

Run the checker only after the audit command succeeds operationally:

```sh
node dist/cli.js audit --input ./incoming.zip --profile agent --json > audit.json && node check-audit.mjs audit.json
```

The audit command itself can still exit `1` for an operational failure. The `&&` prevents the checker from parsing an empty or incomplete report. Use the equivalent conditional mechanism on non-POSIX runners.

## Normalize through a temporary output

Normalization is not conversion and is not transactional. Write to a temporary sibling, then rename only after success.

```sh
node dist/cli.js normalize --input ./incoming.zip --output ./normalized.zip.tmp --profile strict --json > normalize.json
mv ./normalized.zip.tmp ./normalized.zip
```

The `mv` command is shown for POSIX runners. Use the runner's native atomic-replacement strategy when the final path already exists or when running on another platform.

Check [docs/formats.md](../docs/formats.md) before normalizing a non-ZIP format.

## Extract through a staging directory

Use a new directory under a trusted CI workspace and remove it on every failure.

```sh
staging="$(mktemp -d ./archive-staging.XXXXXX)"
trap 'rm -rf "$staging"' EXIT

node dist/cli.js extract --input ./incoming.zip --output "$staging" --profile strict --max-entry-bytes 67108864 --max-total-extracted-bytes 536870912 --json > extract.json

# Publish or rename $staging only after the command succeeds.
```

This shell pattern is intended for POSIX CI runners. Apply equivalent lifecycle handling on other runners.

## Stream and payload rules

- Success JSON is written to stdout with `--json`.
- Usage JSON is written to stdout and exits `2`.
- Known package operational errors are JSON on stderr and exit `1`.
- Native or dependency failures can be text on stderr and exit `1`.
- Keep stdout and stderr separate.
- Persist report `schemaVersion` with stored audit or normalize output.

## Common mistakes

- Treating audit exit `0` as proof that `report.ok` is true.
- Parsing every exit-`1` stderr value as JSON without checking its shape.
- Normalizing directly over the input path.
- Publishing a destination after partial extraction.
- Running extraction in a shared or pre-populated directory.
- Selecting a codec without checking the runtime support matrix.

## Related documentation

- [CLI guide](../docs/cli.md)
- [Safety](../docs/safety.md)
- [Formats](../docs/formats.md)
- [Public contract](../CONTRACT.md)
