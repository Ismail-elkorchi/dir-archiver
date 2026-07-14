# Getting started

This guide runs one complete archive flow from a fresh package installation. It creates its own temporary files, works across operating systems, and removes the temporary workspace when it finishes.

## Before you begin

For Node.js, use version `24` or newer and install the npm package:

```sh
npm install dir-archiver
```

The package is ESM-only. Save the example as `archive-demo.mjs` or use a project whose `package.json` contains `"type": "module"`.

## Run a complete example

Create `archive-demo.mjs`:

```js
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { audit, extract, list, write } from "dir-archiver";

const workspace = await mkdtemp(join(tmpdir(), "dir-archiver-demo-"));

try {
  const source = join(workspace, "project");
  const archive = join(workspace, "project.zip");
  const destination = join(workspace, "extracted");

  await mkdir(join(source, "src"), { recursive: true });
  await writeFile(join(source, "src", "index.js"), "console.log('hello');\n");
  await writeFile(join(source, "package.json"), '{"name":"demo-project"}\n');

  // Write the archive outside the source tree. includeBaseDirectory keeps
  // every entry under project/ inside the ZIP.
  const created = await write(source, archive, {
    includeBaseDirectory: true,
    exclude: ["node_modules", ".git"],
  });

  console.log("created", {
    format: created.format,
    entryCount: created.entryCount,
  });

  // list() reads entry metadata without extracting files.
  const inventory = await list(archive);
  console.log("entries", inventory.entries.map((entry) => entry.name));

  // audit() returns a report. Applications must inspect report.ok.
  const report = await audit(archive, { profile: "agent" });
  console.log("audit", {
    ok: report.ok,
    issues: report.issues.length,
  });

  if (!report.ok) {
    throw new Error(`Archive audit failed: ${JSON.stringify(report.issues)}`);
  }

  // Strict extraction audits again before writing entries. The explicit byte
  // limits bound both one file and the total bytes written by this operation.
  const result = await extract(archive, destination, {
    profile: "strict",
    maxEntryBytes: 64 * 1024 * 1024,
    maxTotalExtractedBytes: 512 * 1024 * 1024,
  });

  const extractedText = await readFile(
    join(destination, "project", "src", "index.js"),
    "utf8",
  );

  console.log("extracted", {
    files: result.extractedFiles,
    skipped: result.skippedEntries,
    text: extractedText.trim(),
  });
} finally {
  await rm(workspace, { recursive: true, force: true });
}
```

Run it:

```sh
node archive-demo.mjs
```

The values include temporary absolute paths internally, but the meaningful output should resemble:

```txt
created { format: 'zip', entryCount: 2 }
entries [ 'project/package.json', 'project/src/index.js' ]
audit { ok: true, issues: 0 }
extracted { files: 2, skipped: 0, text: "console.log('hello');" }
```

Archive entry order is deterministic and lexicographic. The exact console formatting is owned by the runtime and is not an API contract.

## Understand the choices

### Keep the destination outside the source

`write()` opens the output and then walks the source directory. If the output is inside the source, the newly created archive can be discovered during that walk. Place build artifacts in a sibling directory or explicitly exclude the destination.

### Include the source directory

With `includeBaseDirectory: true`, the example stores:

```txt
project/package.json
project/src/index.js
```

With the default `false`, it stores:

```txt
package.json
src/index.js
```

Choose the layout based on how consumers should see files after extraction.

### Inspect before extracting

`list()` answers “what paths are present?” `audit()` answers “what issues does the selected profile report?” Strict `extract()` performs its own audit, so the separate call is for applications that need a report before making a decision.

### Use a new extraction directory

Extraction is not transactional. It creates the destination, replaces matching files, and can leave earlier entries behind if a later entry fails. For external archives, extract into a new staging directory under a trusted parent, then publish that directory only after success. See [Safety](safety.md#recommended-extraction-flow).

## Deno

Install from JSR and change the package import:

```ts
import { audit, extract, list, write } from "jsr:@ismail-elkorchi/dir-archiver";
```

The `node:` filesystem imports in the example are supported by current Deno. Run with the permissions used by the local-file flow:

```sh
deno run --allow-read --allow-write --allow-env --allow-sys archive-demo.ts
```

Add `--allow-net` only when reading an HTTP or HTTPS archive URL. Deno format capabilities differ for Zstandard and Brotli; see [Formats](formats.md#deno).

## Bun

Install the npm package, keep the `dir-archiver` import, and run:

```sh
bun add dir-archiver
bun run archive-demo.mjs
```

## Continue

- [API guide](api.md)
- [CLI guide](cli.md)
- [Safety](safety.md)
- [Formats](formats.md)
- [Troubleshooting](troubleshooting.md)
