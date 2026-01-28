# Changes to Dir Archiver

### 2.2.0 (Unreleased)

* Migrate source to TypeScript with strict compiler options.
* Build compiled output into `dist/` with declaration files.
* Add strict ESLint configuration alongside TypeScript typechecking.
* Require Node.js >=18.
* CLI exits with a non-zero status when required arguments are missing.
* Add a CLI smoke test.
* Skip symlinks by default and add an option to follow them.
* Exclude entries by name anywhere unless a relative path is specified.
* Normalize exclude path separators so Windows-style paths work cross-platform.
* Accept absolute exclude paths when they resolve inside the source tree.
* Make exclude matching case-insensitive on Windows.
* Normalize archive entry paths to forward slashes for cross-platform zip compatibility.
* Traverse entries in deterministic order.
* Honor explicit true/false values for CLI boolean flags.
* Improve error handling for archive creation failures.
* Bump argv-flags to 0.2.0.
* Bump argv-flags to 0.2.1 (inline flag values).

### 2.1.2 (January 28, 2026)

* Add a smoke test suite and npm test script.
* Add CI to run linting and tests.
* Declare Node.js >=14 in package metadata.

### 2.1.1 (January 28, 2026)

* Avoid archiving the destination zip when it lives inside the source directory ([#5](https://github.com/Ismail-elkorchi/dir-archiver/issues/5)).
* `createZip()` now returns a Promise that resolves when the archive is closed ([#13](https://github.com/Ismail-elkorchi/dir-archiver/issues/13)).
* Bump archiver to 7.0.1 to address dependency deprecation warnings ([#14](https://github.com/Ismail-elkorchi/dir-archiver/issues/14)).

### 2.1.0 (October 25, 2022)

* Add ESLint ([#12](https://github.com/Ismail-elkorchi/dir-archiver/pull/12)).
* Several enhancements to better support Microsoft Windows ([Diff](https://github.com/Ismail-elkorchi/dir-archiver/compare/2.0.0...v2.1.0)).

### 2.0.0 (September 20, 2022)

* Bump archiver from 5.2.0 to 5.3.1 ([42c30b7](https://github.com/Ismail-elkorchi/dir-archiver/commit/42c30b7a3b7fa0b3101e21559f1774f45d2f06ce)).
* Add an option to include the base directory in the archive root ([#11](https://github.com/Ismail-elkorchi/dir-archiver/pull/11)).

### 1.2.0 (February 28, 2021)

* Bump archiver from 4.0.2 to 5.2.0 ([b84c347](https://github.com/Ismail-elkorchi/dir-archiver/commit/b84c34731617c57b7c439f15910fcc8fa00747b2)).
* Make exclude paths relative to run directory ([#4](https://github.com/Ismail-elkorchi/dir-archiver/pull/4)).
* Remove the destination zip if it exists already ([#7](https://github.com/Ismail-elkorchi/dir-archiver/pull/7)).

### 1.1.2 (July 21, 2020)

* Bump lodash from 4.17.15 to 4.17.19.
* Bump archiver from 4.0.1 to 4.0.2.

### 1.1.1 (May 14, 2020)

* CLI : prevent execution if the required arguments are missing.

### 1.1.0 (May 13, 2020)

* Add cli script.

### 1.0.1 (May 12, 2020)

* Fix the installation instructions.

### 1.0.0 (May 12, 2020)

* initial release.
