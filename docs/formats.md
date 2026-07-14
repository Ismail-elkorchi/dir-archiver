# Formats

`dir-archiver` accepts these public format identifiers:

```txt
zip, tar, tgz, tar.gz, gz, bz2, tar.bz2, zst, tar.zst, br, tar.br, xz, tar.xz
```

The identifier being accepted by the API does not mean every operation is available for that format on every runtime. Read, write, and normalize capabilities come from the active bytefold runtime adapter.

The tables below describe the current `@ismail-elkorchi/bytefold` `0.8.x` matrix used by `dir-archiver` `3.0.x`.

## Choose a common format

| Goal | Starting choice |
| --- | --- |
| Exchange a directory with broad desktop and server tooling | `zip` |
| Preserve a TAR container without compression | `tar` |
| Use broadly available compressed TAR tooling | `tar.gz` |
| Compress one file on Node.js or Bun | `gz`, `zst`, or `br` |
| Normalize a container archive | `zip`, `tar`, or a supported `tar.*` format |

Check the runtime table before choosing Brotli, Zstandard, BZip2, or XZ.

## Aliases and inference

`tgz` and `tar.gz` describe the same gzip-compressed TAR family. They can both be passed explicitly, but destination extension inference canonicalizes both `.tgz` and `.tar.gz` to `tar.gz`:

```js
const result = await write("./project", "./project.tgz");
console.log(result.format); // tar.gz
```

An explicit request can retain the alias reported by the writer:

```js
const result = await write("./project", "./project.bundle", {
  format: "tgz",
});
console.log(result.format); // tgz
```

`write()` checks compound extensions before shorter ones:

| Destination suffix | Inferred format |
| --- | --- |
| `.zip` | `zip` |
| `.tar` | `tar` |
| `.tgz` | `tar.gz` |
| `.tar.gz` | `tar.gz` |
| `.gz` | `gz` |
| `.bz2` | `bz2` |
| `.tar.bz2` | `tar.bz2` |
| `.zst` | `zst` |
| `.tar.zst` | `tar.zst` |
| `.br` | `br` |
| `.tar.br` | `tar.br` |
| `.xz` | `xz` |
| `.tar.xz` | `tar.xz` |
| unrecognized or missing extension | `zip` |

Use `format` when the filename is intentionally generic:

```js
await write("./project", "./artifact", {
  format: "zip",
});
```

The CLI equivalent is `--format`.

## Node.js and Bun

Node.js and Bun currently share the same bytefold support matrix.

| Format | Detect, list, audit, extract | Write | Normalize | Notes |
| --- | --- | --- | --- | --- |
| `zip` | supported | supported | supported | Recommended general-purpose default. |
| `tar` | supported | supported | supported | No compression. |
| `tgz`, `tar.gz` | supported | supported | supported | Equivalent format family. |
| `gz` | supported | supported for a file source | unsupported | A directory request maps to `tar.gz`. |
| `bz2` | supported | unsupported | unsupported | A directory request maps to `tar.bz2`, which is also not writable. |
| `tar.bz2` | supported | unsupported | supported | Read and normalize only. |
| `zst` | supported | supported for a file source | unsupported | A directory request maps to `tar.zst`. |
| `tar.zst` | supported | supported | supported | Requires active Zstandard capability. |
| `br` | supported with a hint when bytes are ambiguous | supported for a file source | unsupported | A directory request maps to `tar.br`. |
| `tar.br` | supported with a hint when bytes are ambiguous | supported | supported | Requires active Brotli capability. |
| `xz` | supported | unsupported | unsupported | A directory request maps to `tar.xz`, which is also not writable. |
| `tar.xz` | supported | unsupported | supported | Read and normalize only. |

The Node.js CLI uses this matrix because the CLI executable runs on Node.js.

## Deno

Deno currently supports the same ZIP, TAR, gzip, BZip2, and XZ read surface, but Zstandard and Brotli operations are capability-gated by the Deno adapter.

| Format | Detect, list, audit, extract | Write | Normalize | Notes |
| --- | --- | --- | --- | --- |
| `zip` | supported | supported | supported | |
| `tar` | supported | supported | supported | |
| `tgz`, `tar.gz` | supported | supported | supported | |
| `gz` | supported | supported for a file source | unsupported | A directory request maps to `tar.gz`. |
| `bz2` | supported | unsupported | unsupported | |
| `tar.bz2` | supported | unsupported | supported | |
| `xz` | supported | unsupported | unsupported | |
| `tar.xz` | supported | unsupported | supported | |
| `zst`, `tar.zst` | capability-gated | capability-gated | capability-gated | Do not assume availability in the current Deno adapter. |
| `br`, `tar.br` | capability-gated | capability-gated | capability-gated | Do not assume availability in the current Deno adapter. |

A capability-gated operation can fail even though the format name is valid. For portable Deno workflows, prefer ZIP, TAR, or gzip-compressed TAR unless the application has tested the required codec in its target Deno environment.

## Directory sources and single-file codecs

A bare compression codec represents one byte stream, not a directory tree. For directory sources, `write()` maps the request before creating the writer:

| Requested format | Mapped directory format | Node.js/Bun | Deno |
| --- | --- | --- | --- |
| `gz` | `tar.gz` | succeeds | succeeds |
| `zst` | `tar.zst` | succeeds when Zstandard capability is present | capability-gated |
| `br` | `tar.br` | succeeds when Brotli capability is present | capability-gated |
| `bz2` | `tar.bz2` | rejected by the current writer | rejected by the current writer |
| `xz` | `tar.xz` | rejected by the current writer | rejected by the current writer |

When mapping succeeds, `WriteResult.wrappedDirectoryCodec` is `true` and `WriteResult.format` is the mapped format.

```js
const result = await write("./project", "./project.gz", {
  format: "gz",
});

console.log(result.format); // tar.gz
console.log(result.wrappedDirectoryCodec); // true
```

The filename is not rewritten. In this example the bytes are `tar.gz` even though the destination was named `project.gz`. Prefer a destination such as `project.tar.gz` so external tools receive an accurate extension.

## Detection hints

Local paths and URLs normally provide a filename hint. Bytes, streams, and blobs do not.

Brotli signatures are not always enough to distinguish `br` from `tar.br`. Pass `filename` or `format` for non-path input:

```js
await list(bytes, {
  filename: "upload.tar.br",
});
```

```js
await list(bytes, {
  format: "tar.br",
});
```

Forcing the wrong format can produce a parse or decompression error; it does not convert the input.

## Normalize is not conversion

`normalize(input, destination)` writes the same format opened from `input`. The destination extension does not select a new format.

```js
await normalize("./incoming.zip", "./normalized.zip"); // ZIP to ZIP
```

To create a different format, extract to a controlled staging directory and call `write()` with the desired format. That is a separate, non-atomic workflow and needs the same extraction safety controls described in [Safety](safety.md).

Bare single-file formats are not normalizable in the current Node.js/Bun matrix. TAR-based layered formats can be normalizable even when the current writer does not support creating that compression format from scratch, as with `tar.bz2` and `tar.xz`.

## Unsupported-operation errors

The public API validates format names at the type or CLI-parser level, but runtime capability checks happen later.

- `write()` maps its known unsupported BZip2/XZ writer cases to `DIRARCHIVER_UNSUPPORTED_ENTRY`.
- `normalize()` maps absence of reader normalization support to `DIRARCHIVER_NORMALIZE_UNSUPPORTED`.
- Other codec capability failures can surface as dependency errors rather than a `DirArchiverError`.

Handle both package errors and other operational errors. See [Troubleshooting](troubleshooting.md).

## Related pages

- [API: write](api.md#write)
- [API: detect](api.md#detect)
- [API: normalize](api.md#normalize)
- [CLI guide](cli.md)
- [Safety](safety.md)
