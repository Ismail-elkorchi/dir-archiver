# Formats

## Read support

Read operations accept:

```txt
zip, tar, gz, tgz, tar.gz, bz2, tar.bz2, zst, br, tar.zst, tar.br, xz, tar.xz
```

`tgz` and `tar.gz` are the same format family. Detection currently reports
gzip-compressed TAR as `tgz`.

Codec availability can vary by runtime. Bytefold reports unsupported runtime
capabilities directly.

## Write support

`write()` accepts only archive writer formats:

```txt
zip, tar, tgz, tar.gz, tar.zst, tar.br
```

Raw `gz`, `zst`, and `br` streams are compression operations rather than
archives. BZip2 and XZ are read-only. Use Bytefold's compression API directly
when the goal is to compress one byte stream.

Destination inference recognizes:

| Suffix | Format |
| --- | --- |
| `.zip` | `zip` |
| `.tar` | `tar` |
| `.tgz`, `.tar.gz` | `tar.gz` |
| `.tar.zst` | `tar.zst` |
| `.tar.br` | `tar.br` |

An unrecognized suffix defaults to ZIP.

## Normalize

Normalization preserves the reader's archive family; it is not a conversion
selected by the destination suffix.

| Input | Current output |
| --- | --- |
| ZIP | normalized ZIP |
| TAR | normalized TAR |
| layered TAR | normalized inner TAR without recompression |
| bare compressed stream | unsupported |

Use a `.tar` destination for layered TAR normalization. Recompression is a
separate operation.
