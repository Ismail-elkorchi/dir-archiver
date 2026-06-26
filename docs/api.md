# API guide

Use this page when you call `dir-archiver` from JavaScript or TypeScript.

```ts
import {
  DirArchiverError,
  audit,
  detect,
  extract,
  list,
  normalize,
  open,
  write,
} from "dir-archiver";
```

A default namespace export is also available:

```ts
import dirArchiver from "dir-archiver";

await dirArchiver.write("./project", "./project.zip");
```

## Inputs

Read operations accept these input shapes:

```ts
type DirArchiverInput =
  | string
  | URL
  | Uint8Array
  | ArrayBuffer
  | ReadableStream<Uint8Array>
  | Blob;
```

For in-memory inputs, pass `filename` or `format` when extension-based detection cannot help:

```ts
await detect(bytes, {
  filename: "upload.zip",
});
```

## write(source, destination, options?)

Creates an archive from a file or directory path.

```ts
import { write } from "dir-archiver";

const result = await write("./project", "./project.zip", {
  // Keep project/ as the root folder in the archive.
  includeBaseDirectory: true,

  // Exact basenames or relative paths to skip while walking ./project.
  exclude: ["node_modules", ".git", "dist/tmp.txt"],
});

console.log(result.entryCount);
```

### Write options

| Option | Default | What it does |
| --- | --- | --- |
| `format` | inferred from destination, then `zip` | Forces the output format. |
| `includeBaseDirectory` | `false` | Adds the source directory name as the archive root. |
| `followSymlinks` | `false` | Follows symlink targets while reading source directories. |
| `exclude` | `[]` | Skips exact basenames or relative paths from the source root. |
| `profile` | reserved | Present in the type, not forwarded by `write()` in current v3 behavior. |
| `limits` | reserved | Present in the type, not forwarded by `write()` in current v3 behavior. |

### Exclude matching

`exclude` does not use shell glob expansion.

```ts
await write("./project", "./project.zip", {
  exclude: [
    "node_modules",   // skips any entry whose basename is node_modules
    ".git",           // skips any entry whose basename is .git
    "dist/tmp.txt",   // skips this path relative to ./project
  ],
});
```

### Directory wrapping for single-file codecs

When the source is a directory and the requested format is a single-file compression codec, `write()` wraps the directory in the matching TAR-based format.

| Requested format | Actual format for directory source |
| --- | --- |
| `gz` | `tar.gz` |
| `bz2` | `tar.bz2` |
| `xz` | `tar.xz` |
| `zst` | `tar.zst` |
| `br` | `tar.br` |

The return value reports this with `wrappedDirectoryCodec`.

## detect(input, options?)

Identifies an archive format without extracting or listing entries.

```ts
import { detect } from "dir-archiver";

const result = await detect("./bundle.zip");
console.log(result.format);
```

Use `detect()` before choosing a follow-up operation when you do not control the archive filename or extension.

## list(input, options?)

Reads archive entries without writing files to disk.

```ts
import { list } from "dir-archiver";

const result = await list("./bundle.zip");

for (const entry of result.entries) {
  console.log({
    name: entry.name,
    size: entry.size,
    isDirectory: entry.isDirectory,
    isSymlink: entry.isSymlink,
  });
}
```

`entry.size` is a string so JSON output can preserve large values without number precision loss.

## audit(input, options?)

Checks an archive against a safety profile without extracting files.

```ts
import { audit } from "dir-archiver";

const report = await audit("./incoming.zip", {
  profile: "agent",
  limits: {
    maxEntries: 10000,
  },
});

if (!report.ok) {
  console.error(report.issues);
}
```

Use `audit()` before extracting archives from users, CI systems, package registries, uploaded files, or external services.

## extract(input, destination, options?)

Extracts an archive into a directory.

```ts
import { extract } from "dir-archiver";

const result = await extract("./incoming.zip", "./out", {
  profile: "strict",
  maxEntryBytes: 64 * 1024 * 1024,
  maxTotalExtractedBytes: 512 * 1024 * 1024,
});

console.log(result.extractedFiles);
```

### Extract options

| Option | Default | What it does |
| --- | --- | --- |
| `profile` | `strict` | Sets the extraction safety posture. |
| `allowSymlinks` | `false` | Materializes symlink entries only when explicitly enabled. |
| `allowHardlinks` | `false` | Reserved; hard links are rejected in current v3 behavior. |
| `maxEntryBytes` | unset | Maximum size for one extracted file. |
| `maxTotalExtractedBytes` | unset | Maximum total bytes written by one extraction run. |
| `format` | auto-detect | Forces archive format when detection is ambiguous. |
| `password` | unset | Password for encrypted archives when supported by the runtime. |
| `signal` | unset | Cancels long-running operations. |

### Safe extraction pattern

```ts
import { DirArchiverError, audit, extract } from "dir-archiver";

const input = "./incoming.zip";
const output = "./out";

const report = await audit(input, { profile: "agent" });
if (!report.ok) {
  throw new Error(`Archive failed audit: ${JSON.stringify(report.issues)}`);
}

try {
  await extract(input, output, {
    profile: "strict",
    maxEntryBytes: 64 * 1024 * 1024,
    maxTotalExtractedBytes: 512 * 1024 * 1024,
  });
} catch (error) {
  if (error instanceof DirArchiverError) {
    console.error(error.code);
  } else {
    throw error;
  }
}
```

## normalize(input, destination, options?)

Rewrites a supported archive into deterministic output.

```ts
import { normalize } from "dir-archiver";

const result = await normalize("./incoming.zip", "./normalized.zip", {
  profile: "strict",
  deterministic: true,
});

console.log(result.report.summary);
```

Use `normalize()` when build and release pipelines need stable archive output. Unsupported normalize targets throw `DIRARCHIVER_NORMALIZE_UNSUPPORTED`.

## open(input, options?)

Opens an archive reader for advanced flows.

```ts
import { open } from "dir-archiver";

const reader = await open("./bundle.zip", {
  profile: "strict",
});

try {
  for await (const entry of reader.entries()) {
    console.log(entry.name);
  }
} finally {
  await reader.dispose?.();
  await reader.close?.();
}
```

Most consumers should prefer `detect()`, `list()`, `audit()`, `extract()`, or `normalize()` because those helpers handle reader cleanup.

## Shared read options

These options are accepted by `open()`, `detect()`, `list()`, `audit()`, `extract()`, and `normalize()` unless an operation says otherwise.

| Option | Default | What it does |
| --- | --- | --- |
| `format` | auto-detect | Forces archive format. |
| `profile` | operation-specific | Applies `compat`, `strict`, or `agent`. |
| `isStrict` | profile-driven | Extra strictness toggle passed to the archive reader. |
| `limits` | unset | Reader or audit resource limits supported by the runtime. |
| `signal` | unset | Cancels an in-flight async operation. |
| `password` | unset | Password for encrypted archives when supported. |
| `filename` | unset | Filename hint for non-path inputs. |

## Safety profiles

| Profile | Use it for |
| --- | --- |
| `compat` | Trusted archives where compatibility is more important than pre-extraction checks. |
| `strict` | Default extraction posture for untrusted or mixed-trust archives. |
| `agent` | Automation flows that should run strict checks plus additional reader assertions. |

Read [Safety](safety.md) before extracting archives from outside your application.

## Errors

`dir-archiver` throws `DirArchiverError` for known package-level failures. Branch on `error.code`.

```ts
import { DirArchiverError, extract } from "dir-archiver";

try {
  await extract("./incoming.zip", "./out", {
    profile: "strict",
  });
} catch (error) {
  if (error instanceof DirArchiverError) {
    switch (error.code) {
      case "DIRARCHIVER_PATH_TRAVERSAL":
        console.error("Archive tried to write outside the output directory.");
        break;
      case "DIRARCHIVER_RESOURCE_LIMIT":
        console.error("Archive exceeded configured extraction limits.");
        break;
      default:
        console.error(error.code);
    }
  } else {
    throw error;
  }
}
```

Current stable package codes are listed in [CONTRACT.md](../CONTRACT.md).

## Related pages

- [Getting started](getting-started.md)
- [CLI guide](cli.md)
- [Formats](formats.md)
- [Troubleshooting](troubleshooting.md)
