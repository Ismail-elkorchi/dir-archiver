# dir-archiver

Archive orchestration for detect/list/audit/extract/normalize/write flows across Node, Deno, and Bun.

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

## Options reference

- [Options reference](https://github.com/Ismail-elkorchi/dir-archiver/blob/main/docs/reference/options.md)
- [CLI reference](https://github.com/Ismail-elkorchi/dir-archiver/blob/main/docs/reference/cli.md)
- [10-minute tutorial: bundle a plugin directory](https://github.com/Ismail-elkorchi/dir-archiver/blob/main/docs/tutorial/bundle-a-plugin.md)

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
- CLI and API contracts are documented in `CONTRACT.md`.

## Links

- [Docs index](https://github.com/Ismail-elkorchi/dir-archiver/blob/main/docs/index.md)
- Reference:
  - [Reference index](https://github.com/Ismail-elkorchi/dir-archiver/blob/main/docs/reference/index.md)
  - [Contract](https://github.com/Ismail-elkorchi/dir-archiver/blob/main/CONTRACT.md)
  - [Security policy](https://github.com/Ismail-elkorchi/dir-archiver/blob/main/SECURITY.md)
- How-to:
  - [How-to index](https://github.com/Ismail-elkorchi/dir-archiver/blob/main/docs/how-to/index.md)
  - [Contributing](https://github.com/Ismail-elkorchi/dir-archiver/blob/main/CONTRIBUTING.md)
- Explanation: [explanation index](https://github.com/Ismail-elkorchi/dir-archiver/blob/main/docs/explanation/index.md)

## Verification

```sh
npm run examples:run
npm run check:fast
npm run check
```
