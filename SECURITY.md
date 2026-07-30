# Security policy

## Threat model

Archive inputs can control entry names, entry types, compressed sizes, uncompressed sizes, and file contents. Risks include:

- absolute paths and path traversal;
- duplicate or colliding names;
- symlink and hard-link behavior;
- decompression and extraction resource exhaustion;
- overwrite of existing destination files;
- partial output after a later failure;
- filesystem redirection through pre-existing symlinked destination components;
- malformed input, unsupported codecs, and remote-input failures.

## Safe consumer baseline

For archives from users, uploads, build systems, package registries, URLs, or other external producers:

1. use `safetyProfile: "strict"` or `safetyProfile: "untrusted"`;
2. set reader limits and extraction materialization limits for the application budget;
3. extract into a new staging directory beneath a trusted parent;
4. keep the staging path free of pre-existing symlinked components;
5. remove the entire staging directory after any failure;
6. publish or rename the staged tree only after success;
7. keep symlink extraction disabled unless the archive layout and destination are controlled;
8. handle both `DirArchiverError` and non-package operational errors.

`extract()` performs its own pre-extraction audit. A separate `audit()` call is useful when the application needs to inspect or approve a report before extraction. Both API and CLI callers must inspect `report.isSafe`; the CLI audit command can exit `0` with `isSafe: false`.

Extraction is not transactional. It creates the destination, replaces matching files, and can leave completed entries after a later error.

Complete guidance and a staging example are in [docs/safety.md](docs/safety.md).

## Reporting a vulnerability

Report suspected vulnerabilities through GitHub Security Advisories for this repository.

Do not open a public issue, discussion, or pull request containing vulnerability details before coordinated disclosure.

Include, when available:

- affected `dir-archiver` and runtime versions;
- archive format;
- minimal reproduction or fixture;
- expected security boundary;
- observed impact;
- operating system and filesystem details;
- whether the input was local, in memory, or remote.

Avoid sending unrelated sensitive archive contents.

## Disclosure workflow

1. Reproduce and assess impact.
2. Develop a patch and regression tests.
3. Coordinate release timing and remediation guidance.
4. Publish the advisory and changelog entry after a fixed release is available.
