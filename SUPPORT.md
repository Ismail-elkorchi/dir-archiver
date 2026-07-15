# Support

## Start with the documentation

- [Getting started](docs/getting-started.md)
- [API guide](docs/api.md)
- [CLI guide](docs/cli.md)
- [Safety](docs/safety.md)
- [Formats](docs/formats.md)
- [Troubleshooting](docs/troubleshooting.md)

## Usage questions and bug reports

Open a GitHub issue with a minimal, non-sensitive reproduction and include:

- `dir-archiver` version;
- runtime name and version;
- operating system;
- API call or exact CLI command;
- archive format and how it was detected or forced;
- input kind: local path, URL, bytes, stream, or blob;
- expected result;
- actual result;
- `DirArchiverError.code` and `context` when present;
- otherwise, the error name and message;
- CLI exit code, stdout, and stderr captured separately;
- audit `schemaVersion`, `ok`, summary, and issues when relevant.

For filesystem problems, include the source, destination, and current-working-directory relationship without publishing private paths. For format problems, include whether the runtime is Node.js, Deno, or Bun because codec capabilities differ.

Avoid attaching confidential archives. Build the smallest fixture that reproduces the problem when possible.

## CLI automation questions

State whether `--json` was used. Remember:

- `audit` can exit `0` with `ok: false`;
- usage failures exit `2`;
- known package failures exit `1` with JSON on stderr;
- native and dependency failures can exit `1` with text on stderr.

## Security reports

Follow [SECURITY.md](SECURITY.md) and use GitHub Security Advisories for private disclosure. Do not open a public issue containing vulnerability details.
