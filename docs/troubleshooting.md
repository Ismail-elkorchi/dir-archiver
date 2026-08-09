# Troubleshooting

| Symptom | Action |
| --- | --- |
| `audit` exits 0 for a rejected archive | Inspect `report.isSafe`; exit 0 means the report was produced. |
| `DIRARCHIVER_PATH_TRAVERSAL` | Reject or rebuild the archive; do not rewrite entry names during extraction. |
| `DIRARCHIVER_RESOURCE_LIMIT` | Inspect the archive and application budget before raising a limit. |
| `DIRARCHIVER_UNSUPPORTED_ENTRY` | Inspect `audit().issues`; the profile, a link, or an entry kind was rejected. |
| `DIRARCHIVER_NORMALIZE_UNSUPPORTED` | The selected reader cannot normalize that input. |
| Exit-2 stderr is not JSON | Invalid CLI invocations always use terminal diagnostics. |
| Exit-1 stderr is not JSON | Native and dependency failures are not relabeled. Treat stderr as diagnostics. |
| A partial destination remains | Remove the staging destination and retry with a new one. |
| Empty directories disappeared | `write()` emits file entries only. |
| An exclusion did not match | Use a basename or exact source-relative path; globs are not supported. |
| Read format is `tgz` after writing `tar.gz` | They identify the same format family. |
| Layered normalization produced TAR | Normalization writes the inner TAR without recompression. |

## Diagnose without extracting

```sh
npx dir-archiver detect --input ./incoming.zip --json
npx dir-archiver list --input ./incoming.zip --json
npx dir-archiver audit \
  --input ./incoming.zip \
  --safety-profile untrusted \
  --json
```

Record the runtime and version, operation, input kind, format, exit code,
stdout, stderr, package error code, and audit issues.

## Handle package and native errors

```js
try {
  await extract(input, destination, options);
} catch (error) {
  if (error instanceof DirArchiverError) {
    console.error(error.code, error.context);
  } else if (error instanceof Error) {
    console.error(error.name, error.message);
  } else {
    console.error(error);
  }
}
```

Common native failures include missing paths, permissions, network requests,
cancellation, and unavailable codec capabilities.

## Publication-safe writes

Archive creation is not atomic. Write a temporary sibling, then rename it after
success. The exact replacement strategy depends on the target filesystem and
whether an existing published file may be replaced.
