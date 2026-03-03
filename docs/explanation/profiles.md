# Profile behavior and tradeoffs

Profiles configure safety posture for audit and extraction.

## compat

- Minimal guardrails.
- Use only for trusted inputs or internal tooling.

## strict

- Blocks traversal, absolute paths, and unsafe entries.
- Enforces explicit resource limits.

## agent

- Same safety posture as strict.
- Adds additional audit assertions for automation pipelines.

Profiles are passed through to bytefold, so bytefold updates may expand the
checked conditions without changing the profile names.
