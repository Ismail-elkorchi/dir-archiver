# CLI reference

The npm package includes a Node.js 24-or-newer executable:

```sh
npx dir-archiver <command> [options]
```

## Commands

| Command | Required options | Purpose |
| --- | --- | --- |
| `write` | `--source`, `--output` | Create an archive. |
| `detect` | `--input` | Detect the input format. |
| `list` | `--input` | List archive entries. |
| `audit` | `--input` | Produce a safety report. |
| `extract` | `--input`, `--output` | Audit and extract. |
| `normalize` | `--input`, `--output` | Write normalized output. |

A command is always required. There is no implicit write mode.

## Options

| Option | Commands | Meaning |
| --- | --- | --- |
| `--input <archive>`, `-i <archive>` | read commands | Input path or URL. |
| `--source <path>`, `-s <path>` | `write` | Source file or directory. |
| `--output <path>`, `-o <path>` | `write`, `extract`, `normalize` | Destination path. |
| `--format <format>` | all | Force read or write format. |
| `--safety-profile <profile>` | read commands | `compatible`, `strict`, or `untrusted`. |
| `--json` | all | Emit machine-readable output. |
| `--include-base-directory` | `write` | Prefix directory entries with the source name. |
| `--follow-symlinks` | `write` | Follow source-tree symlinks. |
| `--exclude <path>` | `write` | Exclude one basename or relative path; repeat as needed. |
| `--allow-symlinks` | `extract` | Materialize safe relative symlink entries. |
| `--max-extracted-file-bytes <n>` | `extract` | Non-negative safe-integer file limit. |
| `--max-total-extracted-bytes <n>` | `extract` | Non-negative safe-integer total limit. |

Write formats are `zip`, `tar`, `tgz`, `tar.gz`, `tar.zst`, and `tar.br`.
Read formats additionally include `gz`, `bz2`, `tar.bz2`, `zst`, `br`, `xz`,
and `tar.xz`.

Boolean options do not consume a following token. Scalar duplicates, unknown
flags, unsupported values, irrelevant options, extra positionals, and
arguments after `--` are errors.

Only the frequently used path options have short forms. Alternative long
spellings such as `--src` and `--dest` are not accepted.

## Examples

```sh
npx dir-archiver write \
  --source ./project \
  --output ./artifacts/project.zip \
  --include-base-directory \
  --exclude node_modules \
  --exclude .git \
  --json
```

```sh
npx dir-archiver extract \
  --input ./incoming.zip \
  --output ./staging/unpacked \
  --safety-profile untrusted \
  --max-extracted-file-bytes 67108864 \
  --max-total-extracted-bytes 536870912 \
  --json
```

## Use audit as a gate

`audit` exits 0 when it successfully produces a report. Inspect `isSafe`:

```js
import { readFile } from "node:fs/promises";

const report = JSON.parse(await readFile("audit.json", "utf8"));
if (!report.isSafe) {
  console.error(report.issues);
  process.exitCode = 1;
}
```

```sh
npx dir-archiver audit \
  --input ./incoming.zip \
  --safety-profile untrusted \
  --json > audit.json &&
node check-audit.mjs
```

## Exit codes and streams

| Exit | Meaning |
| --- | --- |
| `0` | Operation completed. |
| `1` | Operational failure. |
| `2` | Invalid invocation. |

With `--json`, success and usage payloads go to stdout. Known
`DirArchiverError` payloads go to stderr. Other operational failures can emit
plain diagnostic text on stderr.
