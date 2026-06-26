# Support

## Start with the docs

For usage questions, check these pages first:

- [Getting started](docs/getting-started.md)
- [API guide](docs/api.md)
- [CLI guide](docs/cli.md)
- [Safety](docs/safety.md)
- [Formats](docs/formats.md)
- [Troubleshooting](docs/troubleshooting.md)

## Usage questions

Open a GitHub issue and include:

- runtime: Node.js, Deno, or Bun
- runtime version
- `dir-archiver` version
- API call or CLI command
- minimal input layout or archive description
- expected result
- actual result
- full `DirArchiverError.code` or CLI exit code

For CLI automation issues, also include whether `--json` was used and whether stdout and stderr were captured separately.

## Bug reports

Open a GitHub issue with:

- a minimal reproducible example
- exact command or code
- expected behavior
- actual behavior
- archive format
- operating system

Avoid attaching sensitive archives. Rebuild a small fixture that reproduces the issue when possible.

## Security reports

Follow [SECURITY.md](SECURITY.md) for private disclosure.
