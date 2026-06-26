# Contributing

## Development setup

```sh
npm ci
npm run check:fast
npm run check
```

## Verification commands

- `npm run check:fast`: lint + Node test suite without the full runtime matrix.
- `npm run check`: full repository gate with policy checks, lint, tests, security tests, and runtime matrix.
- `npm run examples:run`: runs the offline examples used by docs and smoke checks.

## Change requirements

- Keep ESM-only packaging.
- Preserve Node.js, Deno, and Bun compatibility.
- Add or update tests for behavior changes.
- Update `CONTRACT.md` for public API, CLI, or guarantee changes.
- Update docs for user-facing behavior changes.

## Documentation policy

Consumer docs come first.

User-facing docs should help package consumers complete a job without cloning this repository. Use contributor-only commands only in contributor docs or in clearly labeled contributor notes.

Good consumer examples:

```sh
npm install dir-archiver
npx dir-archiver list --input ./archive.zip --json
```

Good contributor examples:

```sh
npm ci
npm run build
node dist/cli.js list --input ./archive.zip --json
```

When changing docs:

- Keep `README.md` useful as the first successful path.
- Keep `docs/index.md` as the job-based docs map.
- Document every public operation in `docs/api.md`.
- Document every CLI command and long flag in `docs/cli.md`.
- Include comments in non-trivial code examples.
- Explain default values and common mistakes for public options.
- Keep safety guidance linked from archive extraction examples.
- Keep maintainer-only material outside `docs/` when it is not part of the consumer package docs.

## Runtime dependency freshness policy

- Keep direct runtime dependencies in `package.json` and `package-lock.json` on the latest published stable versions before every release.
- Validate with `npm run deps:fresh`; this gate runs in the release workflow.
- If a dependency is stale, update it in a dedicated PR and run `npm run check`.

## Pull request checklist

- [ ] `npm run check` passes locally
- [ ] docs updated for user-facing changes
- [ ] `CONTRACT.md` updated for public API, CLI, or guarantee changes
- [ ] changelog entry added for release-relevant updates
