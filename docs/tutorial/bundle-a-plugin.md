# Tutorial: bundle a plugin directory

## Goal
Create a distributable ZIP that keeps a stable root folder and excludes local
development files.

## Prereqs
- Node `>=24`
- `npm install`
- `npm run build`

## Copy/paste
```sh
tmpdir="$(mktemp -d)"
mkdir -p "$tmpdir/plugin/src" "$tmpdir/plugin/node_modules/demo"
printf 'export const pluginName = \"demo\";\n' > "$tmpdir/plugin/src/index.js"
printf '{\"name\":\"demo\"}\n' > "$tmpdir/plugin/package.json"
printf 'ignore me\n' > "$tmpdir/plugin/package-lock.json"
printf 'ignore me\n' > "$tmpdir/plugin/node_modules/demo/index.js"

node dist/cli.js write \
  --source "$tmpdir/plugin" \
  --output "$tmpdir/bundle.zip" \
  --include-base-directory \
  --exclude node_modules \
  --exclude package-lock.json \
  --json

node dist/cli.js list --input "$tmpdir/bundle.zip" --json
rm -rf "$tmpdir"
```

Runnable example file:

```sh
node examples/bundle-a-plugin.mjs
```

## What you should see
- A ZIP file is created.
- `write` reports `format: "zip"` and a stable `entryCount`.
- `list` shows entries rooted under the plugin directory and does not include
  `node_modules` or `package-lock.json`.

## Common failure modes
- The output extension is missing, so format inference falls back to the wrong
  archive type.
- `includeBaseDirectory` is omitted and extracted files scatter directly into
  the destination root.
- Exclude patterns miss local build artifacts, which leaks development files
  into the distributable archive.

## Related reference
- [CLI reference](../reference/cli.md)
- [Options reference](../reference/options.md)
