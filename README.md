# dir-archiver

`dir-archiver` v3 is a bytefold-backed archive orchestration layer for Node.js, Deno, and Bun.  
ESM-only. Safety profiles: `compat | strict | agent`.

## Install

### npm

```sh
npm install dir-archiver
```

### JSR

```sh
deno add jsr:@ismail-elkorchi/dir-archiver
```

## Quickstart (API)

```ts
import { write, detect, list, extract } from 'dir-archiver';

await write('./project', './project.zip', {
  format: 'zip',
  includeBaseDirectory: true,
  profile: 'strict'
});

const detected = await detect('./project.zip');
const listed = await list('./project.zip');
await extract('./project.zip', './out', { profile: 'strict' });

console.log(detected.format, listed.entries.length);
```

## Public operations

- `open(input, options)`
- `detect(input, options)`
- `list(input, options)`
- `audit(input, options)`
- `extract(input, destination, options)`
- `normalize(input, destination, options)`
- `write(source, destination, options)`

Format surface matches bytefold `ArchiveFormat` support.  
Directory + single-file codec requests are normalized to `tar.<codec>` (`gz`, `bz2`, `xz`, `zst`, `br`).

## CLI

```sh
dir-archiver write --source ./project --output ./project.zip --format zip --json
dir-archiver detect --input ./project.zip --json
dir-archiver list --input ./project.zip --json
dir-archiver audit --input ./project.zip --profile agent --json
dir-archiver extract --input ./project.zip --output ./out --profile strict --json
dir-archiver normalize --input ./project.zip --output ./normalized.zip --json
```

Exit codes:

- `0` success
- `1` operational failure
- `2` usage/validation failure

## Common recipes

### 1) Safe archive audit before extraction

```sh
dir-archiver audit --input ./archive.zip --profile agent --json
```

### 2) Normalize inbound archives for deterministic processing

```sh
dir-archiver normalize --input ./archive.zip --output ./normalized.zip --json
```

### 3) Write tar.gz from a directory

```sh
dir-archiver write --source ./project --output ./project.tar.gz --format tgz --json
```

## Troubleshooting

- `DIRARCHIVER_PATH_TRAVERSAL`: archive contains unsafe paths (`..`, absolute, drive-prefixed).
- `DIRARCHIVER_RESOURCE_LIMIT`: adjust `maxEntryBytes` / `maxTotalExtractedBytes` in extraction options.
- `DIRARCHIVER_RUNTIME_UNSUPPORTED`: runtime feature mismatch; verify Node/Deno/Bun versions.

## Security model

- Archive extraction treats input as untrusted by default.
- Traversal/absolute paths are blocked in strict/agent profiles.
- See `SECURITY.md` and `docs/security-triage.md`.

## Docs

- `docs/V3_CONTRACT.md`
- `CHANGELOG.md`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `SUPPORT.md`
