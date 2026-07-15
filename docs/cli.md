# CLI guide

The `dir-archiver` CLI is the Node.js executable shipped by the npm package. It requires Node.js `>=24`.

The JSR package provides the cross-runtime API; it does not publish the CLI executable.

## Install and run

Install in the project that owns the automation:

```sh
npm install --save-dev dir-archiver
```

Run through the local package binary:

```sh
npx dir-archiver
```

The examples below use one-line commands so they can be adapted to different shells without relying on continuation syntax.

## Commands

`dir-archiver` supports `write`, `open`, `detect`, `list`, `audit`, `extract`, and `normalize`.

| Command | Purpose |
| --- | --- |
| `write` | Create an archive from a local file or directory. |
| `open` | Open an archive and print format/detection metadata. |
| `detect` | Resolve an archive format. |
| `list` | Print JSON-safe entry summaries. |
| `audit` | Print an issue report without extracting. |
| `extract` | Materialize entries in a local directory. |
| `normalize` | Rewrite a supported archive deterministically in the same format. |

When no command token is present, supplying both `--source` and `--output` selects `write`. Explicit commands are easier to review and are used throughout this guide.

## Flags

| Flag | Alias | Commands | Default | Meaning |
| --- | --- | --- | --- | --- |
| `--source` | `--src` | `write` | required | Source file or directory. |
| `--input` | `-i` | every read command | required | Archive path or HTTP/HTTPS URL. |
| `--output` | `--dest`, `-o` | `write`, `extract`, `normalize` | required | Destination archive or directory. |
| `--format` | none | all commands | auto/inferred | Force a public format identifier. |
| `--profile` | none | read, audit, extract, normalize | `strict` | Select `compat`, `strict`, or `agent`. |
| `--json` | none | all commands | `false` | Serialize the command payload as JSON. |
| `--include-base-directory` | `--includebasedir` | `write` | `false` | Prefix directory entries with the source directory name. |
| `--follow-symlinks` | `--followsymlinks` | `write` | `false` | Follow links found while walking a directory source. |
| `--exclude` | none | `write` | `[]` | Repeatable basename or exact relative-path exclusion for a directory source. |
| `--allow-symlinks` | none | `extract` | `false` | Materialize permitted symlink entries. |
| `--allow-hardlinks` | none | `extract` | `false` | Reserved; hard links are still rejected in v3. |
| `--max-entry-bytes` | none | `extract` | unset | Maximum materialized bytes for one file entry. |
| `--max-total-extracted-bytes` | none | `extract` | unset | Maximum total file bytes materialized by the command. |

`--profile` is parsed as a common option, but `write()` currently reserves and ignores writer profiles. Do not use it to infer write-time safety behavior.

Accepted format names are listed in [Formats](formats.md).

## write

```sh
npx dir-archiver write --source ./project --output ./artifacts/project.zip --include-base-directory --exclude node_modules --exclude .git --json
```

Success JSON contains:

```json
{
  "format": "zip",
  "source": "/absolute/path/project",
  "destination": "/absolute/path/artifacts/project.zip",
  "entryCount": 3,
  "wrappedDirectoryCodec": false
}
```

Important behavior:

- `--include-base-directory`, `--exclude`, and `--follow-symlinks` apply to directory traversal.
- A single regular-file source is stored under its basename; those directory-only flags do not filter or rename it.
- `--follow-symlinks` controls links found during a directory walk and is not a containment guarantee for a top-level source path.
- `--exclude` is repeatable and does not expand glob syntax.
- A basename exclusion matches anywhere in the source tree; a path exclusion is exact and source-relative.
- The destination is opened and an existing file is replaced before every source file has been added.
- A failure can leave partial output and can destroy the previous archive at that destination.
- Keep the destination outside the source tree.
- Empty directories and source filesystem metadata are not preserved.

For publication workflows, write to a temporary sibling with an explicit `--format`, then rename it only after the command succeeds. See [Troubleshooting](troubleshooting.md#a-write-replaced-the-previous-destination-before-failing).

## open

```sh
npx dir-archiver open --input ./artifacts/project.zip --profile strict --json
```

The CLI serializes only format and detection metadata:

```json
{
  "format": "zip",
  "detection": {
    "schemaVersion": "1",
    "inputKind": "file",
    "detected": {
      "container": "zip",
      "compression": "none",
      "layers": ["zip"]
    },
    "confidence": "high",
    "notes": ["Format inferred from filename"]
  }
}
```

Detection notes can differ based on whether the format came from an explicit flag, filename, or magic bytes. The CLI does not expose the live reader returned by the API's `open()` function.

## detect

```sh
npx dir-archiver detect --input ./artifacts/project.zip --json
```

Success JSON has the same top-level `format` and `detection` fields shown for `open`.

For ambiguous bytes or a misleading filename, force the format:

```sh
npx dir-archiver detect --input ./artifact.bin --format tar.br --json
```

For gzip-compressed TAR, current read-side filename inference reports `tgz` for both `.tgz` and `.tar.gz`. `write` destination inference reports `tar.gz` for those suffixes. They are equivalent aliases; use `--format` when the exact identifier matters.

## list

```sh
npx dir-archiver list --input ./artifacts/project.zip --json
```

Success JSON contains `format`, `detection`, and `entries`:

```json
{
  "format": "zip",
  "detection": {
    "schemaVersion": "1"
  },
  "entries": [
    {
      "format": "zip",
      "name": "project/src/index.js",
      "size": "42",
      "isDirectory": false,
      "isSymlink": false
    }
  ]
}
```

Entry sizes are strings so JSON does not lose integer precision.

## audit

```sh
npx dir-archiver audit --input ./incoming.zip --profile agent --json
```

A completed audit prints a report with `schemaVersion`, `ok`, `summary`, and `issues`.

```json
{
  "schemaVersion": "1",
  "ok": false,
  "summary": {
    "entries": 3,
    "warnings": 0,
    "errors": 1
  },
  "issues": [
    {
      "code": "ZIP_DUPLICATE_ENTRY",
      "severity": "error",
      "message": "..."
    }
  ]
}
```

### Use audit as a gate

The `audit` command exits `0` when it successfully produces a report, even when `report.ok` is `false`. A CI gate must inspect the payload.

Create `check-audit.mjs`:

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
npx dir-archiver audit --input ./incoming.zip --profile agent --json > audit.json && node check-audit.mjs audit.json
```

The audit command can exit `1` for an unreadable input, unsupported capability, or another operational failure. The `&&` prevents the checker from parsing an empty or incomplete report. Use the equivalent conditional mechanism in shells that do not support this syntax.

## extract

```sh
npx dir-archiver extract --input ./incoming.zip --output ./staging/unpacked --profile strict --max-entry-bytes 67108864 --max-total-extracted-bytes 536870912 --json
```

Success JSON contains:

```json
{
  "format": "zip",
  "destination": "/absolute/path/staging/unpacked",
  "extractedFiles": 2,
  "extractedDirectories": 1,
  "skippedEntries": 0,
  "issues": []
}
```

Strict is the default and performs a pre-extraction audit. The command is not transactional: it creates the destination, replaces matching files, and can leave earlier entries behind after a later failure. Use a new staging directory under a trusted parent and remove it when the command fails.

Symlinks are skipped by default. Agent profile currently treats symlink presence as an audit error, so `--allow-symlinks` does not make an agent audit pass. Hard links are rejected regardless of `--allow-hardlinks` in v3.

See [Safety](safety.md).

## normalize

```sh
npx dir-archiver normalize --input ./incoming.zip --output ./staging/normalized.zip --profile strict --json
```

Success JSON contains the source `format` and a versioned `report`:

```json
{
  "format": "zip",
  "report": {
    "schemaVersion": "1",
    "ok": true,
    "summary": {
      "entries": 10,
      "outputEntries": 10,
      "droppedEntries": 0,
      "renamedEntries": 0,
      "warnings": 0,
      "errors": 0
    },
    "issues": []
  }
}
```

Normalization does not convert formats. Use a destination different from the input and publish the output only after success. Unsupported formats fail with `DIRARCHIVER_NORMALIZE_UNSUPPORTED`.

## Automation contract

`--json` changes payload serialization, not every error produced by the operating system or dependencies.

| Outcome | Exit code | stdout | stderr |
| --- | --- | --- | --- |
| Successful command | `0` | JSON result with `--json`; human output otherwise | normally empty |
| Successful `audit` with `ok: false` | `0` | Audit report | normally empty |
| Usage failure with `--json` | `2` | `DIRARCHIVER_USAGE` JSON | empty |
| Usage failure without `--json` | `2` | empty | Usage text and issues |
| Known `DirArchiverError` failure | `1` | empty | JSON error envelope |
| Native or dependency failure | `1` | empty | Error stack or message; JSON is not guaranteed |

A usage JSON payload has this shape:

```json
{
  "schemaVersion": "1",
  "code": "DIRARCHIVER_USAGE",
  "message": "Invalid CLI arguments.",
  "issues": [
    {
      "code": "REQUIRED",
      "message": "extract requires --input."
    }
  ]
}
```

A known package error on stderr has this shape:

```json
{
  "schemaVersion": "1",
  "name": "DirArchiverError",
  "code": "DIRARCHIVER_RESOURCE_LIMIT",
  "message": "..."
}
```

For robust automation:

1. check the process exit code;
2. parse stdout only when the command contract says it is JSON;
3. keep stderr separate;
4. for `audit`, also check `report.ok`;
5. treat unexpected stderr text as an operational failure rather than parsing it unconditionally as JSON.

Human-readable output uses the Node.js console representation and is not stable for machine parsing.

## Repository-local CLI

Contributors working in this repository can build and invoke the same executable directly:

```sh
npm run build
node dist/cli.js list --input ./archive.zip --json
```

Consumer examples should use the installed binary instead.

## Related pages

- [Getting started](getting-started.md)
- [API guide](api.md)
- [Safety](safety.md)
- [Formats](formats.md)
- [Troubleshooting](troubleshooting.md)
