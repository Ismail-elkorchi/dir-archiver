# Contributing

## Development setup

```sh
npm ci
npm run check:fast
npm run check
```

Node.js `>=24` is required for repository development.

## Verification commands

| Command | Scope |
| --- | --- |
| `npm run build` | Compile TypeScript to `dist/`. |
| `npm run typecheck` | Type-check without emitting files. |
| `npm run lint` | Type-check and run ESLint. |
| `npm test` | Build and run the Node.js API, operation, CLI, docs, and matrix tests. |
| `npm run examples:run` | Run the offline examples and their assertions. |
| `npm run check:fast` | Run lint, JSR docs checks, Node tests, and examples. |
| `npm run check` | Run the full repository policy, security, and runtime matrix. |

## Change requirements

- Keep ESM-only packaging.
- Preserve Node.js, Deno, and Bun API compatibility.
- Keep the CLI contract aligned with its Node.js distribution surface.
- Add or update tests for behavior changes.
- Update `CONTRACT.md` for public API, CLI, result, error, or guarantee changes.
- Update `CHANGELOG.md` for release-relevant changes.
- Update consumer documentation in the same pull request as user-facing behavior.

## Documentation information architecture

Each subject has one canonical consumer page:

| Subject | Canonical file |
| --- | --- |
| Repository and package landing page | `README.md` |
| Documentation navigation | `docs/index.md` |
| First successful flow | `docs/getting-started.md` |
| Programmatic surface | `docs/api.md` |
| CLI commands and automation | `docs/cli.md` |
| Extraction security and staging | `docs/safety.md` |
| Runtime and operation format support | `docs/formats.md` |
| Failure diagnosis | `docs/troubleshooting.md` |
| Stability boundary | `CONTRACT.md` |
| Vulnerability reporting | `SECURITY.md` |
| Maintainer-only runbooks | `maintenance/` |

Do not add a second tutorial, recipe, reference, or how-to page when the content belongs in one of these files. Add a section to the canonical page and link directly to that section.

`docs/` is included in npm and JSR packages. `maintenance/` is repository-only and must not be used as consumer documentation.

## Documentation quality rules

Consumer documentation must:

- work from a package installation rather than requiring a repository clone;
- distinguish the cross-runtime API from the Node.js npm CLI;
- use examples that match the public types and implementation;
- explain defaults, side effects, return values, and failure behavior;
- keep archive outputs outside their source directories;
- use a new staging directory in untrusted extraction examples;
- state when an operation replaces files or can leave partial output;
- treat `audit().ok` separately from process success;
- distinguish `DirArchiverError` from native and dependency errors;
- avoid implying that every public format supports every operation or runtime;
- include comments where an option changes archive layout or security behavior;
- avoid copying the same full example across multiple pages.

Contributor-only examples may use `npm run build` and `node dist/cli.js`. Consumer CLI examples should use the installed binary, normally `npx dir-archiver`.

## Documentation checks

`test/cli-docs-drift.test.mjs` verifies that `docs/cli.md` includes every supported command and long flag from `src/cli-args.ts`.

`test/docs-links.test.mjs` verifies local Markdown file links and heading anchors across root project docs, `docs/`, `maintenance/`, and `.github/`.

When changing headings or moving files, run:

```sh
npm test
```

A green link test does not validate behavioral claims. Review changes against:

- `src/core.ts` for operation behavior;
- `src/cli.ts` and `src/cli-args.ts` for CLI behavior;
- `src/types.ts` and `src/errors.ts` for public types;
- operation, CLI, security, and runtime-matrix tests;
- the pinned bytefold support matrix for format capabilities.

## Source documentation

Exported JSDoc and Markdown must agree. In particular:

- `WriteOptions.exclude` is exact basename or source-relative matching, not glob matching;
- `WriteOptions.profile` and `WriteOptions.limits` are reserved in v3;
- `allowHardlinks` is reserved and does not enable hard-link extraction;
- the public `ArchiveReader` type does not define a portable lifecycle method.

The repository docs-policy gate checks exported-symbol coverage, while JSR checks validate generated API documentation.

## Runtime dependency freshness policy

- Keep direct runtime dependencies in `package.json` and `package-lock.json` on the latest published stable versions before every release.
- Validate with `npm run deps:fresh`; the release workflow also runs this gate.
- Update stale dependencies in a focused pull request and run `npm run check`.

## Pull request checklist

- [ ] `npm run check` passes locally or the PR explains which unavailable runtime check was not run
- [ ] behavior changes have tests
- [ ] consumer docs match the implementation
- [ ] local links and anchors pass the docs test
- [ ] `CONTRACT.md` is updated for stability-boundary changes
- [ ] `CHANGELOG.md` includes release-relevant changes
