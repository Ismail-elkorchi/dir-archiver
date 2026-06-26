# CLI guide

Use the CLI when you want archive operations in shell scripts, package scripts, or CI jobs.

## Run the binary

From a project that installed `dir-archiver`:

```sh
npx dir-archiver
```

Contributor note: inside this repository after `npm run build`, the same CLI is available at `node dist/cli.js`.

## Commands

`dir-archiver` supports these commands:

```txt
open, detect, list, audit, extract, normalize, write
```

If you omit the command but pass `--source` and `--output`, the CLI resolves the operation as `write`.

## Common flags

| Flag | Alias | Used by | Default | Notes |
| --- | --- | --- | --- | --- |
| `--source` | `--src` | `write` | required | Source file or directory. |
| `--input` | `-i` | `open`, `detect`, `list`, `audit`, `extract`, `normalize` | required | Archive to read. |
| `--output` | `--dest`, `-o` | `write`, `extract`, `normalize` | required | Archive or directory to write. |
| `--format` | none | most commands | auto/inferred | One of the supported format names. |
| `--profile` | none | read, audit, extract, normalize | `strict` | One of `compat`, `strict`, `agent`. |
| `--json` | none | all commands | `false` | Emit machine-readable JSON. |
| `--include-base-directory` | `--includebasedir` | `write` | `false` | Store entries under the source directory name. |
| `--follow-symlinks` | `--followsymlinks` | `write` | `false` | Follow symlink targets while reading source directories. |
| `--exclude` | none | `write` | `[]` | Repeatable exact basename or relative-path exclusion. |
| `--allow-symlinks` | none | `extract` | `false` | Materialize symlink entries. |
| `--allow-hardlinks` | none | `extract` | `false` | Reserved; hard links are rejected in current v3 behavior. |
| `--max-entry-bytes` | none | `extract` | unset | Maximum bytes for one extracted file. |
| `--max-total-extracted-bytes` | none | `extract` | unset | Maximum total bytes written by one extraction run. |

## write

Creates an archive from a file or directory.

```sh
dir-archiver write \
  --source ./project \
  --output ./project.zip \
  --include-base-directory \
  --exclude node_modules \
  --exclude .git \
  --json
```

JSON result shape:

```json
{
  "format": "zip",
  "source": "/absolute/path/project",
  "destination": "/absolute/path/project.zip",
  "entryCount": 3,
  "wrappedDirectoryCodec": false
}
```

Notes:

- `--format` is optional when the destination extension is enough.
- `--include-base-directory` keeps files under `project/` inside the archive.
- `--exclude` may be repeated.
- `--exclude` uses exact basenames or relative paths, not shell glob expansion.

## open

Opens an archive and returns the detected format payload used by CLI consumers.

```sh
dir-archiver open \
  --input ./project.zip \
  --profile strict \
  --json
```

JSON result shape:

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
    "notes": ["Format inferred from magic bytes"]
  }
}
```

## detect

Identifies the archive format without listing or extracting entries.

```sh
dir-archiver detect \
  --input ./project.zip \
  --json
```

JSON result shape:

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
    "notes": ["Format inferred from magic bytes"]
  }
}
```

## list

Lists archive entries without extracting files.

```sh
dir-archiver list \
  --input ./project.zip \
  --json
```

JSON result shape:

```json
{
  "format": "zip",
  "detection": { "schemaVersion": "1" },
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

Use `list` before extraction when you want to see the paths an archive contains.

## audit

Checks archive safety without writing files.

```sh
dir-archiver audit \
  --input ./incoming.zip \
  --profile agent \
  --json
```

JSON result shape:

```json
{
  "schemaVersion": "1",
  "ok": true,
  "summary": {
    "entries": 3,
    "warnings": 0,
    "errors": 0
  },
  "issues": []
}
```

Use `audit` before extracting archives from users, uploads, external services, package registries, or CI inputs.

## extract

Extracts files into a directory.

```sh
dir-archiver extract \
  --input ./incoming.zip \
  --output ./out \
  --profile strict \
  --max-entry-bytes 67108864 \
  --max-total-extracted-bytes 536870912 \
  --json
```

JSON result shape:

```json
{
  "format": "zip",
  "destination": "/absolute/path/out",
  "extractedFiles": 2,
  "extractedDirectories": 1,
  "skippedEntries": 0,
  "issues": []
}
```

Notes:

- `extract` defaults to the strict profile.
- Symlinks are skipped unless `--allow-symlinks` is set.
- Hard links are rejected in current v3 behavior even though `--allow-hardlinks` is reserved for the CLI contract.
- Use byte limits for archives you did not create.

## normalize

Rewrites a supported archive into deterministic output.

```sh
dir-archiver normalize \
  --input ./incoming.zip \
  --output ./normalized.zip \
  --profile strict \
  --json
```

JSON result shape:

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

Unsupported normalize targets fail with `DIRARCHIVER_NORMALIZE_UNSUPPORTED`.

## JSON output and streams

For automation, pass `--json` and keep stdout and stderr separate.

| Outcome | Exit code | Stream | Payload |
| --- | --- | --- | --- |
| Success | `0` | stdout | Command result JSON. |
| Runtime or archive-policy failure | `1` | stderr | `DirArchiverError` JSON. |
| Usage or validation failure | `2` | stdout with `--json`, stderr otherwise | `DIRARCHIVER_USAGE` payload. |

Example usage failure:

```sh
set +e
dir-archiver extract --json
status=$?
set -e
printf 'status=%s\n' "$status"
```

JSON payload shape:

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

## Formats

Accepted format names:

```txt
zip, tar, tgz, tar.gz, gz, bz2, tar.bz2, zst, tar.zst, br, tar.br, xz, tar.xz
```

Read [Formats](formats.md) for operation-level support notes.

## Related pages

- [Getting started](getting-started.md)
- [API guide](api.md)
- [Safety](safety.md)
- [Troubleshooting](troubleshooting.md)
