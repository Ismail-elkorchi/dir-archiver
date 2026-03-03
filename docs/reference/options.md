# Options reference

This page is the single reference for public option fields in `dir-archiver`.
For CLI commands and flags, see [CLI reference](cli.md).

## `OpenOptions`

Used by `open`, `detect`, `list`, and `audit`.

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `format` | `ArchiveFormat` | auto-detect | Force a format when detection by bytes/filename is ambiguous. |
| `profile` | `compat \| strict \| agent` | bytefold default | Safety profile passed to archive readers/audit. |
| `isStrict` | `boolean` | profile-driven | Explicit strict-mode override. |
| `limits` | `ArchiveLimits` | none | Resource ceilings for parse/audit operations. |
| `signal` | `AbortSignal` | none | Cancels long-running operations. |
| `password` | `string` | none | Password for encrypted archives where supported. |
| `filename` | `string` | none | Filename hint for extension-based detection. |

## `ExtractOptions`

`ExtractOptions` extends `OpenOptions`.

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `profile` | `compat \| strict \| agent` | `strict` | `extract` defaults to strict safety posture. |
| `allowSymlinks` | `boolean` | `false` | When `false`, symlink entries are skipped. |
| `allowHardlinks` | `boolean` | `false` | Hard-link entries are currently rejected with `DIRARCHIVER_UNSUPPORTED_ENTRY`. |
| `maxEntryBytes` | `number` | none | Maximum bytes for one extracted file entry. |
| `maxTotalExtractedBytes` | `number` | none | Maximum cumulative bytes written during extraction. |

## `WriteOptions`

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `format` | `ArchiveFormat` | inferred from destination extension, fallback `zip` | Also wraps directory + single-file codec requests (`gz` -> `tar.gz`, etc.). |
| `includeBaseDirectory` | `boolean` | `false` | Include source directory name as archive root path prefix. |
| `followSymlinks` | `boolean` | `false` | Follow symlinks while traversing source directories. |
| `exclude` | `string[]` | `[]` | Exact basename or relative-path matches to skip while traversing the source root (not glob patterns). |
| `profile` | `ArchiveProfile` | none | Present in API type; currently reserved and not forwarded by `write()`. |
| `limits` | `ArchiveLimits` | none | Present in API type; currently reserved and not forwarded by `write()`. |

## Examples

```ts
import { extract, write } from "dir-archiver";

await extract("./archive.zip", "./out", {
  profile: "strict",
  maxTotalExtractedBytes: 512 * 1024 * 1024,
});

await write("./project", "./project.zip", {
  includeBaseDirectory: true,
  exclude: ["tmp", "nested/skip.txt"],
});
```
