# Tutorial: first archive flow

## Goal
Write an archive, detect its format, and extract it with strict safety defaults.

## Prereqs
- Node `>=24`
- `npm install`
- `npm run build`

## Copy/paste
```sh
tmpdir="$(mktemp -d)"
mkdir -p "$tmpdir/project"
printf 'hello from tutorial\n' > "$tmpdir/project/hello.txt"

node dist/cli.js write \
  --source "$tmpdir/project" \
  --output "$tmpdir/project.zip" \
  --include-base-directory \
  --json

node dist/cli.js detect --input "$tmpdir/project.zip" --json

node dist/cli.js extract \
  --input "$tmpdir/project.zip" \
  --output "$tmpdir/out" \
  --profile strict \
  --json

find "$tmpdir/out" -maxdepth 3 -type f | sort
rm -rf "$tmpdir"
```

## What you should see
- `write` reports `format: "zip"` and `wrappedDirectoryCodec: false`.
- `detect` reports `format: "zip"` plus a `detection` object.
- `extract` reports at least one extracted file and one extracted directory.
- `find` prints a path ending in `/project/hello.txt`.

## Common failure modes
- `--include-base-directory` is omitted and the extracted files land directly
  in the destination root.
- The output archive extension is missing or mismatched, so format inference is
  not what you expected.
- Extraction is run with `compat` on untrusted input, which weakens path and
  entry checks.

## Related reference
- [CLI reference](../reference/cli.md)
- [Options reference](../reference/options.md)
- [Contract](../../CONTRACT.md)
