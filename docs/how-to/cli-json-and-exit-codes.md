# How-to: use CLI JSON output and exit codes

## Goal
Drive `dir-archiver` from automation without scraping human-readable command
output.

## Prereqs
- Node `>=24`
- `npm install`
- `npm run build`

## Copy/paste
```sh
tmpdir="$(mktemp -d)"
mkdir -p "$tmpdir/src"
printf 'hello from dir-archiver\n' > "$tmpdir/src/hello.txt"

node dist/cli.js write --source "$tmpdir/src" --output "$tmpdir/archive.zip" --json
node dist/cli.js detect --input "$tmpdir/archive.zip" --json

set +e
node dist/cli.js extract --json
usage_exit=$?
set -e

printf 'usage_exit=%s\n' "$usage_exit"
rm -rf "$tmpdir"
```

## What you should see
- `write` emits JSON on stdout with fields shaped like:

```json
{
  "format": "zip",
  "source": "/tmp/.../src",
  "destination": "/tmp/.../archive.zip",
  "entryCount": 1,
  "wrappedDirectoryCodec": false
}
```

- `detect` emits JSON on stdout with `format` plus a `detection` object.
- The invalid `extract --json` invocation emits a usage payload on stdout shaped
  like:

```json
{
  "schemaVersion": "1",
  "code": "DIRARCHIVER_USAGE",
  "message": "Invalid CLI arguments.",
  "issues": [
    { "code": "REQUIRED", "message": "extract requires --input." },
    { "code": "REQUIRED", "message": "extract requires --output." }
  ]
}
```

- `usage_exit=2` confirms the usage-error exit code.

## Exit codes

| Exit code | Meaning | Where to read details |
| --- | --- | --- |
| `0` | Command completed successfully. | stdout (`--json`) or normal console output |
| `1` | Runtime failure or archive-policy failure. | stderr |
| `2` | CLI usage or validation failure. | stdout with `--json`, stderr otherwise |

## Common failure modes
- Scripts scrape prose output instead of passing `--json`.
- Exit codes `1` and `2` are collapsed into one generic failure bucket.
- stdout and stderr are merged, which corrupts JSON parsing.
- Commands are run before `npm run build`, so `dist/cli.js` is missing.

## Related reference
- [CLI reference](../reference/cli.md)
- [Options reference](../reference/options.md)
- [Contract](../../CONTRACT.md)
