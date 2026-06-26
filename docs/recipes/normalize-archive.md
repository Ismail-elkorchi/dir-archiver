# Normalize an archive

Use this recipe when you need deterministic archive output for release, caching, or comparison workflows.

## API

```ts
import { DirArchiverError, normalize } from "dir-archiver";

try {
  const result = await normalize("./incoming.zip", "./normalized.zip", {
    profile: "strict",

    // This is the default, but keeping it visible documents the intent.
    deterministic: true,
  });

  console.log(result.report.summary);
} catch (error) {
  if (error instanceof DirArchiverError) {
    if (error.code === "DIRARCHIVER_NORMALIZE_UNSUPPORTED") {
      console.error("This archive format cannot be normalized by the active runtime.");
    } else {
      console.error(error.code);
    }
    process.exitCode = 1;
  } else {
    throw error;
  }
}
```

## CLI

```sh
dir-archiver normalize \
  --input ./incoming.zip \
  --output ./normalized.zip \
  --profile strict \
  --json
```

## When to normalize

Normalize when your pipeline compares, caches, signs, or republishes archive bytes and needs stable output from supported formats.

## What can fail

| Failure | Meaning | Response |
| --- | --- | --- |
| `DIRARCHIVER_NORMALIZE_UNSUPPORTED` | The opened reader cannot normalize that format. | Skip normalization or use another format. |
| `DIRARCHIVER_PATH_TRAVERSAL` | Safety checks rejected an entry path. | Reject or rebuild the archive. |
| `DIRARCHIVER_RESOURCE_LIMIT` | A configured limit was exceeded. | Inspect before raising limits. |

## Related pages

- [Formats](../formats.md)
- [API guide](../api.md#normalizeinput-destination-options)
- [CLI guide](../cli.md#normalize)
- [Troubleshooting](../troubleshooting.md)
