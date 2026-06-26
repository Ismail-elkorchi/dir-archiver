# Create a ZIP from a directory

Use this recipe when you want a distributable ZIP from a project, plugin, build output, or asset directory.

## API

```ts
import { detect, list, write } from "dir-archiver";

const source = "./plugin";
const output = "./plugin.zip";

const written = await write(source, output, {
  // Keeps entries under plugin/ inside the ZIP.
  includeBaseDirectory: true,

  // Exact basenames or relative paths to skip from the source tree.
  exclude: ["node_modules", ".git", "package-lock.json"],
});

console.log(`created ${written.destination}`);
console.log(`entries: ${written.entryCount}`);

const detected = await detect(output);
console.log(`format: ${detected.format}`);

const listed = await list(output);
for (const entry of listed.entries) {
  console.log(entry.name);
}
```

## CLI

```sh
dir-archiver write \
  --source ./plugin \
  --output ./plugin.zip \
  --include-base-directory \
  --exclude node_modules \
  --exclude .git \
  --exclude package-lock.json \
  --json

dir-archiver list \
  --input ./plugin.zip \
  --json
```

## What to check

The archive entries should look like this:

```txt
plugin/README.md
plugin/package.json
plugin/src/index.js
```

They should not look like this unless you intentionally omitted `includeBaseDirectory`:

```txt
README.md
package.json
src/index.js
```

## Common mistakes

| Mistake | Result | Fix |
| --- | --- | --- |
| Omit `includeBaseDirectory` | Extracted files land directly in the output directory. | Set `includeBaseDirectory: true` or `--include-base-directory`. |
| Use wildcard exclusions | Files may still be included. | Use exact basenames or relative paths. |
| Rely only on extension inference for unusual paths | Output format may not be what you expected. | Pass `format: "zip"` or `--format zip`. |

## Related pages

- [Getting started](../getting-started.md)
- [API guide](../api.md#write-source-destination-options)
- [CLI guide](../cli.md#write)
- [Formats](../formats.md)
