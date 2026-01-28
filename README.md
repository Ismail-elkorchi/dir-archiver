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

```javascript
// Require modules.
var DirArchiver = require('dir-archiver');

// Create an array with the files and directories to exclude.
const excludes = ['directory_name', 'file.extension'];

/**
 * Create a dir-archiver object. 
 * @param {string} directoryPath - The path of the folder to archive.
 * @param {string} zipPath - The path of the zip file to create.
 * @param {boolean} includeBaseDirectory - Includes a base directory at the root of the archive.
 * For example, if the root folder of your project is named "your-project", setting
 * includeBaseDirectory to true will create an archive that includes this base directory.
 * If this option is set to false the archive created will unzip its content to
 * the current directory.
 * @param {string[]} excludes - A list with the names of the files and folders to exclude. Names without path separators
 * will match anywhere; use a relative path (for example, "nested/file.txt") to exclude a specific path.
 * @param {boolean} followSymlinks - Follow symlinks when traversing directories. Default: false.
*/
var archive = new DirArchiver('path/to/directory', 'path/to/destination/zipfile.zip', true, excludes, false);

// Create the zip file.
archive.createZip().then(() => {
  console.log('Archive ready');
}).catch((err) => {
  console.error(err);
});

// Or with async/await:
// await archive.createZip();
```
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

# Testing

```sh
$ npm test
```

# Development

```sh
$ npm run build
$ npm run lint
```

Linting runs TypeScript typechecking and ESLint. CI runs lint and tests on Node 18/20/22.



[changelog-image]: https://img.shields.io/badge/changelog-md-blue.svg?style=flat-square
[changelog-url]: CHANGELOG.md
[license-image]: https://img.shields.io/npm/l/dir-archiver.svg?style=flat-square
[license-url]: LICENSE
[npm-image]: https://img.shields.io/npm/v/dir-archiver.svg?style=flat-square
[npm-url]: https://www.npmjs.com/package/dir-archiver
