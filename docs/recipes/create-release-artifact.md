# Create a release artifact

Use this recipe when a build or release pipeline needs a ZIP artifact and a machine-readable summary.

## API

```ts
import { detect, write } from "dir-archiver";

const artifact = "./release-artifact.zip";

const written = await write("./dist", artifact, {
  // Keeps files under dist/ when the artifact is extracted.
  includeBaseDirectory: true,
  format: "zip",
});

const detected = await detect(artifact);

const summary = {
  artifact,
  format: detected.format,
  entryCount: written.entryCount,
  wrappedDirectoryCodec: written.wrappedDirectoryCodec,
};

console.log(JSON.stringify(summary, null, 2));
```

## CLI

```sh
dir-archiver write \
  --source ./dist \
  --output ./release-artifact.zip \
  --format zip \
  --include-base-directory \
  --json > artifact-summary.json

dir-archiver detect \
  --input ./release-artifact.zip \
  --json
```

## CI tips

- Use `--json` so later steps do not scrape prose output.
- Keep stdout and stderr separate.
- Persist the JSON summary as a job artifact when later jobs need it.
- Use `includeBaseDirectory` so extracted release files land under a stable root folder.
- Run `list` before publishing if you need a final manifest of included files.

## Verify contents before publishing

```sh
dir-archiver list \
  --input ./release-artifact.zip \
  --json > artifact-entries.json
```

## Related pages

- [CLI guide](../cli.md)
- [API guide](../api.md)
- [Formats](../formats.md)
- [Troubleshooting](../troubleshooting.md)
