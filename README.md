# Dir Archiver

Agent-grade directory archiver for Node.js 24+. ESM-only, deterministic, and built on `zip-next`.

## Installation

```sh
npm install dir-archiver
```

Requires Node.js >=24.

## API

### `createArchive()`

```js
import { createArchive } from 'dir-archiver';

const report = await createArchive({
  sourceDir: './my-project',
  destZip: './my-project.zip',
  includeBaseDirectory: true,
  excludes: ['node_modules', 'dist', 'nested/secret.txt'],
  followSymlinks: false,
  report: 'summary'
});

console.log(report.entryCount, report.totalBytes);
```

### `planArchive()`

```js
import { planArchive } from 'dir-archiver';

const plan = await planArchive({
  sourceDir: './my-project',
  destZip: './my-project.zip',
  excludes: ['node_modules']
});

console.log(plan.entries.length);
```

### Legacy class (compat)

```js
import DirArchiver from 'dir-archiver';

const archive = new DirArchiver('./src', './out.zip');
await archive.createZip();
```

## Options

`createArchive()` accepts:

- `sourceDir` (string, required)
- `destZip` (string, required)
- `includeBaseDirectory` (boolean, default `false`)
- `excludes` (string[], default `[]`)
- `followSymlinks` (boolean, default `false`)
- `report` (`'summary' | 'manifest'`, default `'summary'`)
- `timestamps` (`'preserve' | 'zero' | Date`, default `'preserve'`)
- `signal` (AbortSignal)
- `onProgress` (callback)
- `zip` (ZipWriterOptions without `signal`/`onProgress`)
- `entry` (ZipWriterAddOptions without `signal`/`mtime`)
- `comment` (string)

`report: 'manifest'` includes entry metadata in the returned report.

## CLI

```sh
dir-archiver --src ./my-project --dest ./my-project.zip
dir-archiver --src ./my-project --dest ./my-project.zip --includebasedir=true --exclude node_modules
dir-archiver --src ./my-project --dest ./my-project.zip --json --manifest
```

### CLI JSON output

`--json` emits machine-readable output (bigints are strings):

```json
{
  "ok": true,
  "report": {
    "zipPath": "/abs/path/my-project.zip",
    "entryCount": 42,
    "totalBytes": "123456"
  }
}
```

## Notes

- Archive entries are sorted deterministically (lexicographic by path).
- Matching is case-insensitive on Windows.
- Absolute exclude paths inside the source tree are normalized to relative paths.
- Zip entries always use forward slashes.

## Testing

```sh
npm test
```
