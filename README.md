# Dir Archiver
Compress a whole directory (including subdirectories) into a zip file, with options to exclude specific files, or directories.

# Installation

```sh
$ npm install dir-archiver
```

# Usage

```javascript
// Require modules.
var DirArchiver = require('dir-archiver');

// Create an array with the files and directories to exclude.
const excludes = ['directory_name', 'file.extension'];

/**
 * Create a dir-archiver object. 
 * @param {string} directoryPath - the path of the folder to archive.
 * @param {string} zipPath - The path of the zip file to create.
 * @param {array} excludes - A list with the names of the files and folders to exclude.
*/
var archive = new DirArchiver('path/to/directory', 'path/to/desination/zipfile.zip', excludes);

// Create the zip file.
archive.createZip();
```
