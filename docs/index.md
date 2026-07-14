# Documentation

The documentation has one canonical page for each kind of information. Start with the task you need to complete rather than reading every page in order.

## Learn the library

| Page | Read it for |
| --- | --- |
| [Getting started](getting-started.md) | A self-contained create, inspect, audit, and extract flow. |
| [API guide](api.md) | Inputs, signatures, options, results, errors, and operation caveats. |
| [CLI guide](cli.md) | Installation, commands, flags, output streams, exit codes, and CI gating. |
| [Safety](safety.md) | Profiles, untrusted input, resource limits, links, overwrite behavior, and staging. |
| [Formats](formats.md) | Format inference, aliases, write support, normalization, and runtime differences. |
| [Troubleshooting](troubleshooting.md) | Symptoms, causes, diagnostics, and first fixes. |

## Find a task

| Task | Page and section |
| --- | --- |
| Create an archive from a directory | [API: write](api.md#write) |
| Keep a stable root folder in the archive | [API: includeBaseDirectory](api.md#include-the-source-directory) |
| Exclude local files | [API: exclude](api.md#exclude-source-paths) |
| Inspect an archive without extracting | [API: detect and list](api.md#detect) |
| Decide whether an archive is acceptable | [API: audit](api.md#audit) |
| Extract an external archive | [Safety: recommended extraction flow](safety.md#recommended-extraction-flow) |
| Use the CLI in automation | [CLI: automation contract](cli.md#automation-contract) |
| Fail a CI job when audit reports issues | [CLI: audit as a gate](cli.md#use-audit-as-a-gate) |
| Choose a format | [Formats](formats.md) |
| Normalize output | [API: normalize](api.md#normalize) |
| Handle failures | [Troubleshooting](troubleshooting.md) |

## Contracts and project policies

- [Public behavior contract](../CONTRACT.md)
- [Security policy](../SECURITY.md)
- [Support](../SUPPORT.md)
- [Contributing](../CONTRIBUTING.md)
- [Changelog](../CHANGELOG.md)

Maintainer-only CI notes live under [`maintenance/`](../maintenance/README.md) and are not part of the published consumer documentation.
