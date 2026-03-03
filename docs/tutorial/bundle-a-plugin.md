# Tutorial: bundle a plugin directory

## Goal
Create a distributable ZIP that keeps a stable root folder and excludes local
development files.

## Prereqs
- Node `>=24`
- `npm install`
- `npm run build`

## Copy/paste
CLI-style command:

```sh
dir-archiver write \
  --includebasedir \
  --src . \
  --dest ../bundle.zip \
  --exclude .git \
  --exclude node_modules \
  --exclude package-lock.json \
  --exclude package.json \
  --json
```

Runnable example file:

```sh
node examples/bundle-a-plugin.mjs
```

## What you should see
- A ZIP file is created.
- JSON output reports `format: "zip"`.
- Excluded paths (`.git`, `node_modules`, lock/package manifests) are omitted.

## Safety notes
> [!NOTE]
> `--includebasedir` preserves one top-level folder in the archive. This keeps
> extraction deterministic and prevents files from scattering into whichever
> directory the user extracts into.
