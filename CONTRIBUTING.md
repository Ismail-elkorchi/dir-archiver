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
| `npm test` | Build and run the Node.js API, operation, CLI, documentation, and matrix tests. |
| `npm run examples:run` | Run the offline examples and their assertions. |
| `npm run check:fast` | Run lint, generated API documentation checks, Node.js tests, and examples. |
| `npm run check` | Run the full policy, security, and runtime matrix. |

## Change requirements

- Keep ESM-only packaging.
- Preserve Node.js, Deno, and Bun API compatibility.
- Keep the CLI contract aligned with its Node.js npm distribution.
- Add or update tests for behavior changes.
- Update `CONTRACT.md` for public API, CLI, result, error, or guarantee changes.
- Update `CHANGELOG.md` for release-relevant changes.
- Update consumer documentation in the same pull request as user-facing behavior.

## Documentation ownership

Each subject has one canonical consumer page:

| Subject | Canonical file |
| --- | --- |
| Package landing page and first useful example | `README.md` |
| Documentation navigation | `docs/index.md` |
| Complete first-use flow | `docs/getting-started.md` |
| Programmatic surface | `docs/api.md` |
| Commands and automation | `docs/cli.md` |
| Extraction security and staging | `docs/safety.md` |
| Runtime and operation format support | `docs/formats.md` |
| Failure diagnosis and recovery | `docs/troubleshooting.md` |
| Stability boundary | `CONTRACT.md` |
| Vulnerability reporting | `SECURITY.md` |

Do not add a second tutorial, recipe, how-to, explanation, or reference page when the content belongs in a canonical page. Add a section to the owning page and link directly to that section.

## Compatibility notices

Paths used by earlier releases under `docs/tutorial/`, `docs/how-to/`, `docs/reference/`, and `docs/explanation/` remain in the source repository only as small moved-page notices.

Each notice must:

- contain exactly one link to its canonical replacement;
- contain no copied examples, option tables, or reference material;
- remain excluded from new npm and JSR packages;
- stay covered by `test/docs-links.test.mjs`.

Do not add new content to a compatibility path.

## Documentation quality rules

Consumer documentation must:

- work from an installed package without requiring a repository clone;
- distinguish the cross-runtime API from the Node.js npm CLI;
- use examples that match the public types, parser, implementation, and runtime matrix;
- explain defaults, return values, side effects, overwrite behavior, and partial-output behavior;
- keep archive destinations outside their source directories;
- use a new staging directory in untrusted extraction examples;
- treat `audit().ok` separately from command success;
- distinguish `DirArchiverError` from native and dependency errors;
- avoid implying that every public format supports every operation or runtime;
- distinguish stable wrapper fields from versioned dependency-owned reports;
- comment choices that change archive layout, resources, or security;
- avoid duplicating full examples across pages.

Consumer CLI examples should use the installed executable, normally `npx dir-archiver`. Repository-local `node dist/cli.js` examples belong only in contributor-oriented instructions.

## Documentation checks

`test/cli-docs-drift.test.mjs` verifies that `docs/cli.md` includes every supported command and long flag from `src/cli-args.ts`.

`test/docs-links.test.mjs` verifies:

- local Markdown targets and heading anchors;
- that links do not escape the repository;
- that npm and JSR Markdown links resolve within each published package;
- that all consumer content stays on the canonical pages;
- that older paths remain minimal moved-page notices.

A green link test does not validate behavioral claims. Review documentation changes against:

- `src/core.ts` for operation behavior;
- `src/cli.ts` and `src/cli-args.ts` for CLI behavior;
- `src/types.ts` and `src/errors.ts` for public types;
- operation, CLI, security, and runtime-matrix tests;
- the pinned bytefold support matrix for format capabilities.

Generated API documentation and Markdown must agree. In particular:

- `WriteOptions.exclude` is basename or exact source-relative matching, not glob matching;
- `WriteOptions.profile` and `WriteOptions.limits` are reserved in v3;
- `allowHardlinks` is reserved and does not enable hard-link extraction;
- the public archive reader type has no portable lifecycle method.

## Runtime dependency freshness policy

- Keep direct runtime dependencies in `package.json` and `package-lock.json` on the latest published stable versions before every release.
- Validate with `npm run deps:fresh`; the release workflow also runs this gate.
- Update stale dependencies in a focused pull request and run `npm run check`.

## Pull request checklist

- [ ] `npm run check` passes locally, or the PR explains any unavailable runtime check
- [ ] behavior changes have tests
- [ ] consumer docs match the implementation and current dependency matrix
- [ ] npm and JSR package-local links pass the documentation test
- [ ] compatibility notices still point to the canonical destinations
- [ ] `CONTRACT.md` is updated for stability-boundary changes
- [ ] `CHANGELOG.md` includes release-relevant changes
