# Breaking changes

## 4.0.0

### Dependencies

- Bytefold now comes from its single root entrypoint.
- argv-flags 2 powers the CLI through a reusable compiled parser.

### API

- Remove the default export. Use named exports.
- Remove `open()`. Import Bytefold directly for a live archive reader.
- Rename `OpenOptions` to `ReadOptions`.
- Replace `DirArchiverInput` and `WriteFormat` aliases with Bytefold's
  `ArchiveInput` and `ArchiveWriterFormat` names.
- Rename `profile` to `safetyProfile`.
- Replace profiles `compat` and `agent` with `compatible` and `untrusted`.
- Remove `isStrict`.
- Rename normalize option `deterministic` to `isDeterministic`.
- Replace loose report and limit placeholders with Bytefold's exact types.
- Remove ignored write options `profile` and `limits`.
- Remove the ignored extraction option `allowHardlinks`.
- Restrict `WriteOptions.format` to actual archive writer formats.
- Remove `WriteResult.wrappedDirectoryCodec`.
- Rename `ListEntry.size` to `sizeInBytes`.
- Rename `maxEntryBytes` to `maxExtractedFileBytes`.
- Rename extraction result fields to `extractedFileCount`,
  `extractedDirectoryCount`, and `skippedEntryCount`, and add
  `extractedSymlinkCount`.
- Reject empty, absolute, and parent-traversing exclusions.
- Remove unused `CliUsageError`, `SupportedCommandMap`, and
  `DirArchiverNamespace` types.
- Remove reserved error codes that the implementation never emitted.

Audit reports now use `isSafe`; normalization reports use `isSuccessful`.
Bytefold reports no longer contain `schemaVersion`.

### CLI

- Remove the `open` command and implicit write-command inference.
- Rename `--profile` to `--safety-profile`.
- Rename `--max-entry-bytes` to `--max-extracted-file-bytes`.
- Replace profile values `compat` and `agent` with `compatible` and
  `untrusted`.
- Remove spelling aliases such as `--src` and `--dest`.
- Remove `--allow-hardlinks`.
- Reject duplicate scalar options and options irrelevant to the command.
- Require one `--exclude` occurrence for each exclusion.
- Reject arguments after `--`.

### Migration example

Before:

```js
import dirArchiver from "dir-archiver";

const report = await dirArchiver.audit(input, { profile: "agent" });
if (!report.ok) {
  throw new Error("unsafe");
}
```

After:

```js
import { audit } from "dir-archiver";

const report = await audit(input, { safetyProfile: "untrusted" });
if (!report.isSafe) {
  throw new Error("unsafe");
}
```
