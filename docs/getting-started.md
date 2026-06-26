# Getting started

This guide creates a tiny folder, writes it to a ZIP archive, inspects the archive, and extracts it with safety limits.

The examples use Node.js and the npm package name. The same API is available in supported Deno and Bun environments after installing the package for that runtime.

## Install

```sh
npm install dir-archiver
```

## Create a small input directory

```sh
mkdir -p demo-project/src
printf 'console.log("hello");\n' > demo-project/src/index.js
printf '{"name":"demo-project"}\n' > demo-project/package.json
```

## Write the archive

Create `archive-demo.mjs`:

```ts
import { write } from "dir-archiver";

const written = await write("./demo-project", "./demo-project.zip", {
  // Keep every archived path under demo-project/.
  // Without this, src/index.js would be stored at the archive root.
  includeBaseDirectory: true,

  // Exclusions are exact basenames or paths relative to the source root.
  exclude: ["node_modules", ".git"],
});

console.log(written);
```

Run it:

```sh
node archive-demo.mjs
```

Expected result shape:

```json
{
  "format": "zip",
  "source": "/absolute/path/demo-project",
  "destination": "/absolute/path/demo-project.zip",
  "entryCount": 2,
  "wrappedDirectoryCodec": false
}
```

## Inspect the archive

Create `inspect-demo.mjs`:

```ts
import { detect, list, audit } from "dir-archiver";

const archive = "./demo-project.zip";

const detected = await detect(archive);
console.log(`format: ${detected.format}`);

const listed = await list(archive);
for (const entry of listed.entries) {
  console.log(entry.name);
}

const report = await audit(archive, {
  // agent is useful in automation because it asks for the strict safety posture
  // plus additional assertions exposed by the archive reader.
  profile: "agent",
});

console.log(`audit ok: ${report.ok}`);
```

Run it:

```sh
node inspect-demo.mjs
```

You should see archive paths under `demo-project/`.

## Extract the archive

Create `extract-demo.mjs`:

```ts
import { DirArchiverError, extract } from "dir-archiver";

try {
  const result = await extract("./demo-project.zip", "./demo-output", {
    // extract() already defaults to strict; keeping it visible makes the
    // extraction policy easy to review.
    profile: "strict",

    // Set limits for archives that may come from outside your application.
    maxEntryBytes: 64 * 1024 * 1024,
    maxTotalExtractedBytes: 512 * 1024 * 1024,
  });

  console.log(result);
} catch (error) {
  if (error instanceof DirArchiverError) {
    console.error(`dir-archiver failed: ${error.code}`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
```

Run it:

```sh
node extract-demo.mjs
find demo-output -maxdepth 3 -type f | sort
```

You should see files under `demo-output/demo-project/`.

## CLI equivalent

```sh
npx dir-archiver write \
  --source ./demo-project \
  --output ./demo-project.zip \
  --include-base-directory \
  --exclude node_modules \
  --exclude .git \
  --json

npx dir-archiver list \
  --input ./demo-project.zip \
  --json

npx dir-archiver extract \
  --input ./demo-project.zip \
  --output ./demo-output \
  --profile strict \
  --max-total-extracted-bytes 536870912 \
  --json
```

## Next steps

- Read the [API guide](api.md) for every exported function.
- Read the [CLI guide](cli.md) for commands, flags, JSON output, and exit codes.
- Read [Safety](safety.md) before extracting archives from users or external systems.
- Use the [Troubleshooting](troubleshooting.md) page when a command or API call fails.
