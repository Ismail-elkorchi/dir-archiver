# Tutorial: first archive flow

## Goal
Write an archive, detect its format, and extract it with strict safety defaults.

## Prereqs
- Node `>=24`
- `npm install`
- `npm run build`

## Copy/paste
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

## What you should see
- `detected.format` prints `zip`.
- `./out` contains the extracted files.

## Safety notes
> [!NOTE]
> Use `profile: "strict"` for extraction unless you have a documented reason to
> weaken constraints.
