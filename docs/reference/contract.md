# Contract

Goal: point API and CLI users to the stable behavior contract that backs the public surface.

The full contract lives at the repo root so it can ship with npm and JSR artifacts alongside the package entrypoints.

Use the root contract for:
- CLI JSON output shape expectations
- exit-code meanings
- stability expectations for named commands and result payloads

Primary contract:
- [CONTRACT.md](../../CONTRACT.md)
