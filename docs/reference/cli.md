# CLI reference

## Goal
Provide one canonical reference for `dir-archiver` CLI commands, flags, JSON
outputs, and exit-code behavior.

## Prereqs
- Build CLI once: `npm run build`
- Binary path in this repo: `dist/cli.js`

## Copy/paste
Show usage:

```sh
node dist/cli.js
```

Run examples:

```sh
node examples/run-all.mjs
```

## What you should see
- Exit code `2` with usage diagnostics for invalid invocations.
- Exit code `0` for successful commands.
- JSON payloads on stdout when `--json` is set.

## Safety notes
> [!NOTE]
> For automation, always pass `--json` and consume stable codes/fields instead
> of parsing human-readable output.

## Common flags

| Flag | Alias | Default | Notes |
| --- | --- | --- | --- |
| `--source` | `--src` | command-specific | Input directory/file for `write`. |
| `--input` | `-i` | command-specific | Archive path for `open`, `detect`, `list`, `audit`, `extract`, `normalize`. |
| `--output` | `--dest`, `-o` | command-specific | Destination path for `write`, `extract`, `normalize`. |
| `--format` | - | inferred/auto | Values: `zip`, `tar`, `tgz`, `tar.gz`, `gz`, `bz2`, `tar.bz2`, `zst`, `tar.zst`, `br`, `tar.br`, `xz`, `tar.xz`. |
| `--profile` | - | `strict` | Values: `compat`, `strict`, `agent`. |
| `--json` | - | `false` | Emit machine-readable JSON on stdout. |
| `--include-base-directory` | `--includebasedir` | `false` | Wrap archive content under the source directory name in `write`. |
| `--follow-symlinks` | `--followsymlinks` | `false` | Follow symlink targets when archiving source input. |
| `--exclude` | - | `[]` | Exclude path globs in `write`. Repeatable. |
| `--allow-symlinks` | - | `false` | Permit symlink extraction targets. |
| `--allow-hardlinks` | - | `false` | Permit hardlink extraction targets. |
| `--max-entry-bytes` | - | unset | Maximum bytes per extracted entry. |
| `--max-total-extracted-bytes` | - | unset | Maximum aggregate extracted bytes per run. |

## Commands

### `write`

Synopsis:

```sh
dir-archiver write --source <path> --src <path> --output <archive> --dest <archive> [--format <format>] [--include-base-directory|--includebasedir] [--follow-symlinks|--followsymlinks] [--exclude <path>...]
```

Example:

```sh
dir-archiver write --source ./plugin --output ./bundle.zip --include-base-directory --exclude .git --json
```

JSON output shape:

```json
{
  "format": "zip",
  "source": "./plugin",
  "destination": "./bundle.zip",
  "entryCount": 3,
  "wrappedDirectoryCodec": false
}
```

### `open`

Synopsis:

```sh
dir-archiver open --input <archive> [--format <format>] [--profile <profile>] [--json]
```

Example:

```sh
dir-archiver open --input ./bundle.zip --json
```

JSON output shape:

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

### `detect`

Synopsis:

```sh
dir-archiver detect --input <archive> [--json]
```

Example:

```sh
dir-archiver detect --input ./bundle.zip --json
```

JSON output shape:

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

### `list`

Synopsis:

```sh
dir-archiver list --input <archive> [--json]
```

Example:

```sh
dir-archiver list --input ./bundle.zip --json
```

JSON output shape:

```json
{
  "format": "zip",
  "detection": { "...": "same shape as detect/open" },
  "entries": [
    {
      "format": "zip",
      "name": "plugin/index.js",
      "size": "42",
      "isDirectory": false,
      "isSymlink": false
    }
  ]
}
```

### `audit`

Synopsis:

```sh
dir-archiver audit --input <archive> [--profile <profile>] [--json]
```

Example:

```sh
dir-archiver audit --input ./bundle.zip --profile agent --json
```

JSON output shape:

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

### `extract`

Synopsis:

```sh
dir-archiver extract --input <archive> --output <directory> [--profile <profile>] [--allow-symlinks] [--allow-hardlinks] [--max-entry-bytes <n>] [--max-total-extracted-bytes <n>] [--json]
```

Example:

```sh
dir-archiver extract --input ./bundle.zip --output ./out --profile strict --max-total-extracted-bytes 536870912 --json
```

JSON output shape:

```json
{
  "format": "zip",
  "destination": "./out",
  "extractedFiles": 2,
  "extractedDirectories": 1,
  "skippedEntries": 0,
  "issues": []
}
```

### `normalize`

Synopsis:

```sh
dir-archiver normalize --input <archive> --output <archive> [--profile <profile>] [--json]
```

Example:

```sh
dir-archiver normalize --input ./incoming.zip --output ./normalized.zip --profile strict --json
```

JSON output shape:

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

## Exit codes and stderr/stdout contract

- Exit `0`: success.
- Exit `1`: operational failure (typed `DirArchiverError` JSON on stderr).
- Exit `2`: usage/validation failure (`DIRARCHIVER_USAGE` with `issues`).

For machine consumers:
- stdout is reserved for success payloads (especially with `--json`).
- stderr is reserved for diagnostics/failures.
