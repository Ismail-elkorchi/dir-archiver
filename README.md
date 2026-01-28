[![npm][npm-image]][npm-url] [![license][license-image]][license-url]
[![changelog][changelog-image]][changelog-url]

# Dir Archiver
Compress a whole directory (including subdirectories) into a zip file, with options to exclude specific files or directories.

# Installation

```sh
$ npm install dir-archiver
```

Requires Node.js >=18.

# Usage

## API

Quick start (async/await):

```javascript
const DirArchiver = require('dir-archiver');

const archive = new DirArchiver(
  './my-project',
  './my-project.zip',
  true,
  ['node_modules', 'dist', 'nested/secret.txt'],
  false
);

await archive.createZip();
```

Signature:

```ts
new DirArchiver(
  directoryPath: string,
  zipPath: string,
  includeBaseDirectory?: boolean,
  excludes?: string[],
  followSymlinks?: boolean
)
```

Parameters:
- `directoryPath`: Root folder to archive (must exist).
- `zipPath`: Destination zip file path (parent directory must exist).
- `includeBaseDirectory`: When true, the archive contains the source folder as the top-level directory.
- `excludes`: Names or relative paths to skip. Names without path separators match anywhere; use a relative path
  (for example, `nested/file.txt`) to target a specific entry. Trailing slashes can target directories (for example, `cache/`).
  Windows-style backslashes are accepted and normalized. Absolute paths inside the source tree are accepted and converted
  to relative excludes. Matching is case-insensitive on Windows.
- `followSymlinks`: Follow symlinks when traversing directories. Default: `false`.

`createZip()` returns a Promise that resolves with the zip path when the archive is finalized and rejects on failure.
Zip entries always use forward slashes, regardless of OS, and are added in deterministic order.

## Command Line Interface

```sh
Usage: dir-archiver --src <path-to-directory> --dest <path-to-file>.zip --includebasedir true|false --exclude folder-name file-name.extension

Options:
  --src             The path of the folder to archive.                            [string][required]
  --dest            The path of the zip file to create.                           [string][required]
  --includebasedir  Includes a base directory at the root of the archive.
                    For example, if the root folder of your project is named
                    "your-project", setting this option to true will create
                    an archive that includes this base directory.
                    If this option is set to false the archive created will
                    unzip its content to the current directory.                               [bool]
  --followsymlinks  Follow symlinks when traversing directories.                              [bool]
  --exclude         A list with the names of the files and folders to exclude. Names without
                    path separators match anywhere; use a relative path to target a specific
                    entry. Windows-style backslashes are accepted and normalized.           [array]
```

Inline values are supported for flags (for example, `--includebasedir=true` or `--exclude=cache`).

# CLI examples

```sh
# Basic
dir-archiver --src ./my-project --dest ./my-project.zip

# Include base directory and exclude node_modules anywhere
dir-archiver --src ./my-project --dest ./my-project.zip --includebasedir=true --exclude node_modules

# Exclude a specific path
dir-archiver --src ./my-project --dest ./my-project.zip --exclude nested/secret.txt

# Windows-style excludes (backslashes are normalized)
dir-archiver --src . --dest archive.zip --exclude .\\nested\\skip.txt

# Follow symlinks
dir-archiver --src ./my-project --dest ./my-project.zip --followsymlinks=true
```

# Testing

```sh
$ npm test
```

# Development

```sh
$ npm install
$ npm run typecheck
$ npm run build
$ npm run lint
```

Linting runs TypeScript typechecking and ESLint. CI runs lint and tests on Node 18/20/22 across Linux, macOS, and Windows.



[changelog-image]: https://img.shields.io/badge/changelog-md-blue.svg?style=flat-square
[changelog-url]: CHANGELOG.md
[license-image]: https://img.shields.io/npm/l/dir-archiver.svg?style=flat-square
[license-url]: LICENSE
[npm-image]: https://img.shields.io/npm/v/dir-archiver.svg?style=flat-square
[npm-url]: https://www.npmjs.com/package/dir-archiver
