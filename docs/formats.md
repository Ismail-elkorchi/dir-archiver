# Formats

`dir-archiver` accepts these public identifiers:

```txt
zip, tar, tgz, tar.gz, gz, bz2, tar.bz2, zst, tar.zst, br, tar.br, xz, tar.xz
```

A valid identifier does not mean every operation is available on every runtime. Read, write, and normalization capabilities come from the active bytefold adapter.

The tables below describe the current `@ismail-elkorchi/bytefold` `0.8.x` behavior used by `dir-archiver` `3.0.x`.

## Choose a format

| Goal | Starting choice |
| --- | --- |
| Exchange a directory with broad tooling support | `zip` |
| Store a TAR container without compression | `tar` |
| Create a broadly supported compressed TAR | `tar.gz` |
| Compress one file on Node.js or Bun | `gz`, `zst`, or `br` |
| Produce deterministic normalized output without changing container family | `zip` or `tar` |

Check the runtime matrix before choosing Brotli, Zstandard, BZip2, or XZ.

## `tgz` and `tar.gz`

`tgz` and `tar.gz` identify the same gzip-compressed TAR family, but write and read operations report aliases differently.

### Write behavior

Destination inference maps both suffixes to `tar.gz`:

```js
const result = await write("./project", "./project.tgz");
console.log(result.format); // "tar.gz"
```

An explicit writer request retains the requested alias:

```js
const result = await write("./project", "./project.bundle", {
  format: "tgz",
});
console.log(result.format); // "tgz"
```

### Read behavior

Current read operations canonicalize gzip-compressed TAR to `tgz`:

```js
console.log((await detect("./project.tgz")).format); // "tgz"
console.log((await detect("./project.tar.gz")).format); // "tgz"
console.log((await detect("./project.tar.gz", { format: "tar.gz" })).format); // "tgz"
```

The explicit format selects the parser but does not preserve the alias in the result. Treat `tgz` and `tar.gz` as equivalent in application logic.

## Write inference

`write()` checks compound suffixes before shorter ones:

| Destination suffix | Inferred write format |
| --- | --- |
| `.zip` | `zip` |
| `.tar` | `tar` |
| `.tgz` | `tar.gz` |
| `.tar.gz` | `tar.gz` |
| `.gz` | `gz` |
| `.tar.bz2` | `tar.bz2` |
| `.bz2` | `bz2` |
| `.tar.zst` | `tar.zst` |
| `.zst` | `zst` |
| `.tar.br` | `tar.br` |
| `.br` | `br` |
| `.tar.xz` | `tar.xz` |
| `.xz` | `xz` |
| unrecognized or missing suffix | `zip` |

Use `format` when the destination name is generic:

```js
await write("./project", "./artifact", { format: "zip" });
```

The CLI equivalent is `--format`.

## Node.js and Bun

Node.js and Bun currently share the same bytefold capability matrix.

| Format | Read, list, audit, extract | Write | Normalization output |
| --- | --- | --- | --- |
| `zip` | supported | supported | normalized ZIP |
| `tar` | supported | supported | normalized TAR |
| `tgz`, `tar.gz` | supported; read result is `tgz` | supported | normalized inner TAR, no gzip |
| `gz` | supported | one file | unsupported |
| `bz2` | supported | unsupported | unsupported |
| `tar.bz2` | supported | unsupported | normalized inner TAR, no BZip2 |
| `zst` | supported | one file | unsupported |
| `tar.zst` | supported | supported | normalized inner TAR, no Zstandard |
| `br` | filename or explicit format hint required | one file | unsupported |
| `tar.br` | filename or explicit format hint required | supported | normalized inner TAR, no Brotli |
| `xz` | supported | unsupported | unsupported |
| `tar.xz` | supported | unsupported | normalized inner TAR, no XZ |

The Node.js CLI uses this matrix because the executable runs on Node.js.

## Deno

Deno supports the ZIP, TAR, gzip, BZip2, and XZ read surface. Zstandard and Brotli operations are capability-gated by the current Deno adapter.

| Format | Read, list, audit, extract | Write | Normalization output |
| --- | --- | --- | --- |
| `zip` | supported | supported | normalized ZIP |
| `tar` | supported | supported | normalized TAR |
| `tgz`, `tar.gz` | supported; read result is `tgz` | supported | normalized inner TAR, no gzip |
| `gz` | supported | one file | unsupported |
| `bz2` | supported | unsupported | unsupported |
| `tar.bz2` | supported | unsupported | normalized inner TAR, no BZip2 |
| `xz` | supported | unsupported | unsupported |
| `tar.xz` | supported | unsupported | normalized inner TAR, no XZ |
| `zst`, `tar.zst` | capability-gated | capability-gated | capability-gated; layered success writes TAR |
| `br`, `tar.br` | capability-gated | capability-gated | capability-gated; layered success writes TAR |

For portable Deno workflows, prefer ZIP, TAR, or gzip-compressed TAR unless the target environment has been tested with the required codec.

## Directory sources and bare codecs

A bare compression codec represents one byte stream, not a directory tree. For a directory source, `write()` maps the request before writer capability is checked:

| Requested format | Mapped directory format | Node.js/Bun | Deno |
| --- | --- | --- | --- |
| `gz` | `tar.gz` | succeeds | succeeds |
| `zst` | `tar.zst` | succeeds | capability-gated |
| `br` | `tar.br` | succeeds | capability-gated |
| `bz2` | `tar.bz2` | rejected | rejected |
| `xz` | `tar.xz` | rejected | rejected |

When mapping succeeds, `WriteResult.wrappedDirectoryCodec` is `true` and `WriteResult.format` is the mapped format.

```js
const result = await write("./project", "./project.gz", {
  format: "gz",
});

console.log(result.format); // "tar.gz"
console.log(result.wrappedDirectoryCodec); // true
```

The filename is not rewritten. In this example the bytes are gzip-compressed TAR even though the filename is `project.gz`. Prefer `project.tar.gz` so other tools receive an accurate suffix.

## Detection hints

Local paths and URLs normally supply a filename. Bytes, streams, and blobs do not.

Brotli input requires a filename or explicit format because byte inspection cannot reliably distinguish `br` from `tar.br`:

```js
await list(bytes, { filename: "upload.tar.br" });
await list(bytes, { format: "tar.br" });
```

Forcing the wrong format produces a parse or decompression error; it does not convert input.

## Normalize is not conversion

`normalize(input, destination)` delegates to the opened reader. The destination suffix does not select an output format.

Current behavior:

- ZIP input writes normalized ZIP.
- TAR input writes normalized TAR.
- Layered TAR input writes the normalized inner TAR and does not reapply compression.
- Bare compressed-stream input does not expose normalization.

For layered input, use a `.tar` destination:

```js
const result = await normalize(
  "./incoming.tar.gz",
  "./normalized.tar",
  { deterministic: true },
);

console.log(result.format); // "tgz": identifies the input reader
```

The result's `format` field identifies the opened source reader, not the emitted byte format. Recompression is a separate workflow: normalize to TAR, then archive that TAR or a controlled directory using the desired writer.

Use a destination different from the input. Normalization can leave a partial destination after failure.

## Unsupported-operation errors

- Known BZip2 and XZ writer restrictions are mapped by `write()` to `DIRARCHIVER_UNSUPPORTED_ENTRY`.
- A reader without normalization support causes `DIRARCHIVER_NORMALIZE_UNSUPPORTED`.
- Runtime codec failures can surface as dependency errors rather than `DirArchiverError`.

Handle both package errors and other operational errors. See [Troubleshooting](troubleshooting.md).

## Related pages

- [API: write](api.md#write)
- [API: detect](api.md#detect)
- [API: normalize](api.md#normalize)
- [CLI guide](cli.md)
- [Safety](safety.md)
