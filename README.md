# dir-archiver

Deterministic directory archiving and extraction over zip, tar, and layered compression.

Supports Node.js, Deno, and Bun.

## What it is

`dir-archiver` provides one API surface for archive operations with explicit safety profiles and stable error codes.

## Install

```sh
npm install dir-archiver
deno add jsr:@ismail-elkorchi/dir-archiver
```

## Quickstart

```ts
import { write, detect, extract } from "dir-archiver";

await write("./project", "./project.zip", {
  format: "zip",
  includeBaseDirectory: true,
});

const detected = await detect("./project.zip");
await extract("./project.zip", "./out", { profile: "strict" });

console.log(detected.format);
```

## When not to use

- You only need a low-level parser for a single format.
- You target CommonJS-only environments or Node < 24.
- You need interactive archive browsing UI features.

## When to use

- You need one API for detect, list, audit, extract, normalize, and write.
- You want deterministic normalization for CI pipelines.
- You need safety profiles for untrusted inputs.

## Compatibility

- Module system: ESM-only.
- Runtimes: Node `>=24`, current Deno, current Bun.
- CLI and API contracts are documented in [Contract](https://github.com/Ismail-elkorchi/dir-archiver/blob/main/CONTRACT.md).

## Documentation

- [Docs index](https://github.com/Ismail-elkorchi/dir-archiver/blob/main/docs/index.md)
- [Tutorial: bundle a plugin directory](https://github.com/Ismail-elkorchi/dir-archiver/blob/main/docs/tutorial/bundle-a-plugin.md)
- [Reference: CLI](https://github.com/Ismail-elkorchi/dir-archiver/blob/main/docs/reference/cli.md)

## Verification

```sh
npm run examples:run
npm run check:fast
npm run check
```
