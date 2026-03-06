# How-to: troubleshoot common failures

## Goal
Map common `dir-archiver` failures to the likely option or input problem
without guessing from raw shell output.

## Prereqs
- Node `>=24`
- `npm install`
- `npm run build`

## Copy/paste
```sh
tmpdir="$(mktemp -d)"
mkdir -p "$tmpdir/src"
printf 'hello world\n' > "$tmpdir/src/hello.txt"
node dist/cli.js write --source "$tmpdir/src" --output "$tmpdir/archive.zip" --json >/dev/null

set +e
node dist/cli.js extract \
  --input "$tmpdir/archive.zip" \
  --output "$tmpdir/out" \
  --max-entry-bytes 4 \
  --json
runtime_exit=$?

node dist/cli.js extract --json
usage_exit=$?
set -e

printf 'runtime_exit=%s\n' "$runtime_exit"
printf 'usage_exit=%s\n' "$usage_exit"

node dist/cli.js detect --input "$tmpdir/archive.zip" --json
node dist/cli.js list --input "$tmpdir/archive.zip" --json
rm -rf "$tmpdir"
```

## What you should see
- The first `extract` fails with a `DirArchiverError` JSON payload on stderr
  shaped like:

```json
{
  "schemaVersion": "1",
  "name": "DirArchiverError",
  "code": "DIRARCHIVER_RESOURCE_LIMIT",
  "message": "..."
}
```

- `runtime_exit=1` confirms a runtime/archive-policy failure.
- The second `extract --json` emits a `DIRARCHIVER_USAGE` payload on stdout and
  `usage_exit=2`.
- `detect` and `list` still succeed. Use them to inspect the archive before
  trying a different `extract` policy or limit.

## Quick diagnosis table

| Symptom | Likely cause | First fix |
| --- | --- | --- |
| Exit `2` with `DIRARCHIVER_USAGE` | Missing or invalid command flags | Compare the command to the [CLI reference](../reference/cli.md). |
| Exit `1` with `DIRARCHIVER_RESOURCE_LIMIT` | `maxEntryBytes` or `maxTotalExtractedBytes` is lower than the archive requires | Raise the limit or audit first to size the archive. |
| Exit `1` with `DIRARCHIVER_PATH_TRAVERSAL` or `DIRARCHIVER_UNSUPPORTED_ENTRY` | Strict/agent safety checks rejected an entry path or link | Run `audit` or `list` first and keep `compat` only for trusted input. |
| Raw `ENOENT` or a missing-path stack trace | The input or output path is wrong for the current working directory | Re-run with absolute paths or verify the file exists. |

## Common failure modes
- Missing input files or missing output directories.
- Unsupported archive formats or encrypted inputs without the required
  password/support.
- Strict extraction rejecting traversal-style or link-based entries.
- Treating an exit code alone as the diagnosis instead of reading the JSON
  error `code`.

## Related reference
- [CLI reference](../reference/cli.md)
- [Options reference](../reference/options.md)
- [Contract](../../CONTRACT.md)
