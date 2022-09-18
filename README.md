[![npm][npm-image]][npm-url] [![license][license-image]][license-url]
[![changelog][changelog-image]][changelog-url]

# Dir Archiver
Compress a whole directory (including subdirectories) into a zip file, with options to exclude specific files, or directories.

# Installation

```sh
$ npm install dir-archiver
```

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
 * @param {Boolean} includeBaseDirectory - Includes a base directory at the root of the archive.
 * For example, if the root folder of your project is named "your-project", setting
 * includeBaseDirectory to true will create an archive that includes this base directory.
 * If this option is set to false the archive created will unzip its content to
 * the current directory.
 * @param {array} excludes - A list with the names of the files and folders to exclude.
*/
var archive = new DirArchiver('path/to/directory', 'path/to/desination/zipfile.zip', excludes);

// Create the zip file.
archive.createZip();
```
## Command Line Interface

```sh
Usage: dir-archiver --src <path-to-directory> --dest <path-to-file>.zip --exclude folder-name file-name.extention

Options:
  --src             The path of the folder to archive.
  --dest            The path of the zip file to create.
  --includebasedir  Includes a base directory at the root of the archive.
                    For example, if the root folder of your project is named
                    "your-project", setting includeBaseDirectory to true will
                    create an archive that includes this base directory.
                    If this option is set to false the archive created will
                    unzip its content to the current directory.
  --exclude         Specify a list with the names of the files and folders to exclude
```



[changelog-image]: https://img.shields.io/badge/changelog-md-blue.svg?style=flat-square
[changelog-url]: CHANGELOG.md
[license-image]: https://img.shields.io/npm/l/dir-archiver.svg?style=flat-square
[license-url]: LICENSE
[npm-image]: https://img.shields.io/npm/v/dir-archiver.svg?style=flat-square
[npm-url]: https://www.npmjs.com/package/dir-archiver
