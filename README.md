# dir-archiver

Create, inspect, audit, normalize, and extract archives through a small ESM API.

`dir-archiver` adds deterministic filesystem traversal, safe extraction, and
task-level results to [Bytefold](https://github.com/Ismail-elkorchi/bytefold).
It supports Node.js 24 or newer, Deno, and Bun.

## Install

```sh
npm install dir-archiver
bun add dir-archiver
```

For Deno:

```sh
deno add jsr:@ismail-elkorchi/dir-archiver
```

## Example

```js
import { audit, extract, list, write } from "dir-archiver";

await write("./project", "./artifacts/project.zip", {
  includeBaseDirectory: true,
  exclude: ["node_modules", ".git"],
});

const inventory = await list("./artifacts/project.zip");
console.log(inventory.entries);

const report = await audit("./artifacts/project.zip", {
  safetyProfile: "untrusted",
});
if (!report.isSafe) {
  throw new Error(`Archive rejected: ${JSON.stringify(report.issues)}`);
}

await extract("./artifacts/project.zip", "./artifacts/unpacked", {
  safetyProfile: "strict",
  maxExtractedFileBytes: 64 * 1024 * 1024,
  maxTotalExtractedBytes: 512 * 1024 * 1024,
});
```

## API

| Operation | Purpose |
| --- | --- |
| `write(source, destination, options?)` | Create an archive from a local file or directory. |
| `detect(input, options?)` | Detect the archive and compression layers. |
| `list(input, options?)` | Return JSON-safe entry summaries. |
| `audit(input, options?)` | Return Bytefold's safety report. |
| `extract(input, destination, options?)` | Audit and extract with path and byte-limit enforcement. |
| `normalize(input, destination, options?)` | Write deterministic normalized output when supported. |

The package does not expose Bytefold's live reader. Import Bytefold directly
when you need entry streams or lower-level reader methods.

`write()` accepts archive writer formats: `zip`, `tar`, `tgz`, `tar.gz`,
`tar.zst`, and `tar.br`. Read operations also accept Bytefold's read-only and
raw-compression formats.

## CLI

```sh
npx dir-archiver --help

npx dir-archiver write \
  --source ./project \
  --output ./artifacts/project.zip \
  --exclude node_modules \
  --exclude .git \
  --json

npx dir-archiver extract \
  --input ./artifacts/project.zip \
  --output ./artifacts/unpacked \
  --safety-profile strict \
  --json
```

Every value-taking option occurrence has one value. Repeat `--exclude` for
repeated exclusions. Unknown flags, duplicate scalar options, irrelevant
options, and arguments after `--` are usage errors.

The command comes before its command-specific options. `--json` controls
successful operation results; invalid invocations always write concise
diagnostics to stderr and exit with status `2`. Use `-h` or `--help` for root
or command help, and `--version` for the installed version.

## Operational limits

- Writing and extraction are not transactional; use temporary destinations
  when partial output is unacceptable.
- Extraction rejects unsafe archive paths and audits before creating the
  destination. Use a new directory below a trusted parent.
- Symlink entries are skipped unless `allowSymlinks` is true. Hard links are
  rejected.
- `followSymlinks` can archive targets outside the source directory; enable it
  only for a trusted filesystem layout.
- Source files and extracted entries are currently buffered in memory.
- `maxExtractedFileBytes` and `maxTotalExtractedBytes` limit extracted data;
  Bytefold's `limits` control parsing and decompression.
- Filesystem, network, cancellation, and Bytefold errors can surface directly.
  Package policy failures use `DirArchiverError.code`.

## Documentation

- [API reference](docs/api.md)
- [CLI reference](docs/cli.md)
- [Safety](docs/safety.md)
- [Formats](docs/formats.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Breaking changes](BREAKING_CHANGES.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)
