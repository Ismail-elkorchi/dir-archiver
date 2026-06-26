# dir-archiver documentation

This documentation is organized around the jobs package consumers need to complete.

## Start here

| Page | Use it when |
| --- | --- |
| [Getting started](getting-started.md) | You want to create, inspect, and extract your first archive. |
| [API guide](api.md) | You use `dir-archiver` from JavaScript or TypeScript. |
| [CLI guide](cli.md) | You use `dir-archiver` from a shell, script, or CI job. |
| [Safety](safety.md) | You extract archives that may come from users or external systems. |
| [Formats](formats.md) | You need to choose or force an archive format. |
| [Troubleshooting](troubleshooting.md) | You need to map failures to fixes. |

## Recipes

| Recipe | Job |
| --- | --- |
| [Create a ZIP from a directory](recipes/create-zip-from-directory.md) | Build a distributable archive while excluding local files. |
| [Inspect an archive before extracting](recipes/inspect-archive-before-extracting.md) | Detect, list, and audit before writing files. |
| [Extract an untrusted archive](recipes/extract-untrusted-archive.md) | Apply strict profile checks and size limits. |
| [Create a release artifact](recipes/create-release-artifact.md) | Produce a ZIP artifact and JSON summary for automation. |
| [Normalize an archive](recipes/normalize-archive.md) | Rewrite supported archives into deterministic output. |

## Contracts and project files

- [Public behavior contract](../CONTRACT.md)
- [Security policy](../SECURITY.md)
- [Support](../SUPPORT.md)
- [Contributing](../CONTRIBUTING.md)
- [Changelog](../CHANGELOG.md)
