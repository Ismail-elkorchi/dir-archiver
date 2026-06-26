# Formats

`dir-archiver` exposes one set of format names across the API and CLI.

```txt
zip, tar, tgz, tar.gz, gz, bz2, tar.bz2, zst, tar.zst, br, tar.br, xz, tar.xz
```

Format support depends on the operation. Reading an archive, writing an archive, and normalizing an archive do not have the same constraints.

## Choosing a format

| Goal | Good default |
| --- | --- |
| Share a directory with most tools | `zip` |
| Unix-style archive without compression | `tar` |
| Compressed TAR with broad tooling support | `tar.gz` or `tgz` |
| Single-file compression | `gz`, `zst`, or `br` for file sources |
| Deterministic release artifact | `zip` plus `includeBaseDirectory: true`, then `normalize()` when supported |

## Format inference

`write()` infers the output format from the destination extension:

```ts
await write("./project", "./project.zip"); // zip
await write("./project", "./project.tar.gz"); // tar.gz
```

Use `format` when the destination path does not include the extension you want:

```ts
await write("./project", "./artifact", {
  format: "zip",
});
```

The CLI equivalent is `--format`:

```sh
dir-archiver write \
  --source ./project \
  --output ./artifact \
  --format zip \
  --json
```

## Directory sources and single-file codecs

Single-file compression formats normally wrap one file, not a directory tree. When the source is a directory and you request a single-file codec, `write()` converts the output format to a TAR-based archive when the writer supports it.

| Requested format | Directory output format |
| --- | --- |
| `gz` | `tar.gz` |
| `bz2` | `tar.bz2` |
| `xz` | `tar.xz` |
| `zst` | `tar.zst` |
| `br` | `tar.br` |

The return payload reports whether wrapping happened:

```ts
const result = await write("./project", "./project.gz", {
  format: "gz",
});

console.log(result.format); // tar.gz
console.log(result.wrappedDirectoryCodec); // true
```

## Operation notes

| Format | Read, list, audit, extract | Write notes | Normalize notes |
| --- | --- | --- | --- |
| `zip` | Accepted by the public format surface. | Supported by the current writer. | Supported when the active reader exposes normalization. |
| `tar` | Accepted by the public format surface. | Supported by the current writer. | Supported when the active reader exposes normalization. |
| `tgz` | Accepted by the public format surface. | Supported by the current writer. | Supported when the active reader exposes normalization. |
| `tar.gz` | Accepted by the public format surface. | Supported by the current writer. | Supported when the active reader exposes normalization. |
| `gz` | Accepted by the public format surface. | File sources write as `gz`; directory sources wrap to `tar.gz`. | Supported when the active reader exposes normalization. |
| `bz2` | Accepted by the public format surface. | Current writer rejects `bz2`; directory sources wrap to `tar.bz2`, which is also rejected by the current writer. | Supported when the active reader exposes normalization. |
| `tar.bz2` | Accepted by the public format surface. | Current writer rejects `tar.bz2`. | Supported when the active reader exposes normalization. |
| `zst` | Accepted by the public format surface. | File sources write as `zst`; directory sources wrap to `tar.zst`. | Supported when the active reader exposes normalization. |
| `tar.zst` | Accepted by the public format surface. | Supported by the current writer. | Supported when the active reader exposes normalization. |
| `br` | Accepted by the public format surface. | File sources write as `br`; directory sources wrap to `tar.br`. | Supported when the active reader exposes normalization. |
| `tar.br` | Accepted by the public format surface. | Supported by the current writer. | Supported when the active reader exposes normalization. |
| `xz` | Accepted by the public format surface. | Current writer rejects `xz`; directory sources wrap to `tar.xz`, which is also rejected by the current writer. | Supported when the active reader exposes normalization. |
| `tar.xz` | Accepted by the public format surface. | Current writer rejects `tar.xz`. | Supported when the active reader exposes normalization. |

If a write format is rejected, the API throws `DIRARCHIVER_UNSUPPORTED_ENTRY` under the current v3 contract.

If normalization is unavailable for the opened archive reader, `normalize()` throws `DIRARCHIVER_NORMALIZE_UNSUPPORTED`.

## Extension examples

| Destination | Inferred format |
| --- | --- |
| `project.zip` | `zip` |
| `project.tar` | `tar` |
| `project.tgz` | `tgz` |
| `project.tar.gz` | `tar.gz` |
| `project.gz` | `gz`, then directory sources wrap to `tar.gz` |
| `project.tar.zst` | `tar.zst` |
| `project.br` | `br`, then directory sources wrap to `tar.br` |

## Related pages

- [API guide](api.md#write-source-destination-options)
- [CLI guide](cli.md#formats)
- [Create a ZIP from a directory](recipes/create-zip-from-directory.md)
- [Normalize an archive](recipes/normalize-archive.md)
