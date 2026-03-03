# Contributing

## Development setup

```sh
npm ci
npm run check:fast
npm run check
```

## Verification commands

- `npm run check:fast`: lint + Node test suite (no runtime matrix).
- `npm run check`: full repository gate (policy checks, lint, tests, security tests, runtime matrix).

## Change requirements

- Keep ESM-only packaging.
- Preserve Node + Deno + Bun compatibility.
- Add/update tests for behavior changes.
- Update `CONTRACT.md` for API or guarantee changes.

## Runtime dependency freshness policy

- Keep direct runtime dependencies in `package.json` and `package-lock.json` on the latest published stable versions before every release.
- Validate with `npm run deps:fresh` (this gate runs in the release workflow).
- If a dependency is stale, update it in a dedicated PR and run `npm run check`.

## Pull request checklist

- [ ] `npm run check` passes locally
- [ ] docs updated for user-facing changes
- [ ] changelog entry added for release-relevant updates
