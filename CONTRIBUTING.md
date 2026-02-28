# Contributing

## Development setup

```sh
npm ci
npm run check
```

## Change requirements

- Keep ESM-only packaging.
- Preserve Node + Deno + Bun compatibility.
- Add/update tests for behavior changes.
- Update `docs/V3_CONTRACT.md` for API or guarantee changes.

## Pull request checklist

- [ ] `npm run check` passes locally
- [ ] docs updated for user-facing changes
- [ ] changelog entry added for release-relevant updates
