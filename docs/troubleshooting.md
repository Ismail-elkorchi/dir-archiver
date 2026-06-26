# Troubleshooting

Use this page to connect common symptoms to the first fix to try.

## Quick diagnosis

| Symptom | Likely cause | First fix |
| --- | --- | --- |
| Files extract directly into the output directory instead of a folder | The archive was written without `includeBaseDirectory` | Write the archive with `includeBaseDirectory: true` or `--include-base-directory`. |
| `DIRARCHIVER_RESOURCE_LIMIT` | `maxEntryBytes` or `maxTotalExtractedBytes` is lower than the archive requires | Inspect with `list()` or `dir-archiver list`, then raise limits only when expected. |
| `DIRARCHIVER_PATH_TRAVERSAL` | The archive contains absolute paths or `..` traversal | Reject the archive or ask the producer to rebuild it with safe relative paths. |
| `DIRARCHIVER_UNSUPPORTED_ENTRY` | The archive contains an unsupported entry type or failed strict/agent audit | Run `audit()` or `dir-archiver audit` and inspect issues. |
| `DIRARCHIVER_NORMALIZE_UNSUPPORTED` | The active archive reader cannot normalize that format | Use another format or skip normalization for that input. |
| CLI exit code `2` | Missing or invalid flags | Compare the command with [CLI guide](cli.md). |
| CLI JSON parsing fails | `--json` was omitted or stdout/stderr were merged | Pass `--json`, parse stdout on success, and read stderr for exit code `1`. |
| `ENOENT` or missing path error | Input or output path is wrong for the current working directory | Re-run with absolute paths or verify that the file exists. |

## Handle API errors

```ts
import { DirArchiverError, extract } from "dir-archiver";

try {
  await extract("./incoming.zip", "./out", {
    profile: "strict",
    maxTotalExtractedBytes: 512 * 1024 * 1024,
  });
} catch (error) {
  if (error instanceof DirArchiverError) {
    console.error({
      code: error.code,
      message: error.message,
    });
    process.exitCode = 1;
  } else {
    throw error;
  }
}
```

Branch on `error.code`. Message text is for people and may change.

## Handle CLI errors

Use `--json` for automation:

```sh
set +e
dir-archiver extract \
  --input ./incoming.zip \
  --output ./out \
  --profile strict \
  --max-total-extracted-bytes 16 \
  --json >success.json 2>error.json
status=$?
set -e

printf 'status=%s\n' "$status"
```

Interpret exit codes:

| Exit code | Meaning | Read details from |
| --- | --- | --- |
| `0` | Success | stdout |
| `1` | Archive or runtime failure | stderr |
| `2` | CLI usage or validation failure | stdout with `--json`, stderr otherwise |

## Files landed in the wrong place

Problem:

```txt
out/src/index.js
out/package.json
```

Expected:

```txt
out/project/src/index.js
out/project/package.json
```

Fix the write step:

```ts
await write("./project", "./project.zip", {
  includeBaseDirectory: true,
});
```

CLI equivalent:

```sh
dir-archiver write \
  --source ./project \
  --output ./project.zip \
  --include-base-directory
```

## Exclusions did not match

`exclude` accepts exact basenames or relative paths. It does not expand shell-style wildcards.

```ts
await write("./project", "./project.zip", {
  exclude: [
    "node_modules",      // basename match
    ".git",              // basename match
    "dist/tmp.txt",      // relative path match
  ],
});
```

If a file is still present, run `list()` after writing:

```ts
const result = await list("./project.zip");
console.log(result.entries.map((entry) => entry.name));
```

## Resource limit failures

A limit failure means extraction stopped before writing more bytes than allowed.

```ts
await extract("./incoming.zip", "./out", {
  maxEntryBytes: 64 * 1024 * 1024,
  maxTotalExtractedBytes: 512 * 1024 * 1024,
});
```

Before raising limits:

1. Run `audit()` with `profile: "agent"`.
2. Run `list()` to inspect entry names and available sizes.
3. Decide whether the archive size is expected for your application.

## Safety failures

When strict or agent profile rejects an archive, do not retry with `compat` unless the archive is trusted and your application explicitly accepts the risk.

Preferred flow:

```ts
const report = await audit("./incoming.zip", {
  profile: "agent",
});

if (!report.ok) {
  console.error(report.issues);
  process.exit(1);
}
```

Read [Safety](safety.md) for the full model.

## CLI command examples

```sh
dir-archiver detect --input ./incoming.zip --json

dir-archiver list --input ./incoming.zip --json

dir-archiver audit --input ./incoming.zip --profile agent --json
```

These commands do not extract files and are good first checks when a later extraction fails.

## Related pages

- [Getting started](getting-started.md)
- [API guide](api.md)
- [CLI guide](cli.md)
- [Safety](safety.md)
- [Formats](formats.md)
