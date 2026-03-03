# Security policy

## Threat model

- Archive inputs are untrusted by default.
- Common risks include path traversal, symlink abuse, hard-link abuse, and resource exhaustion.
- Runtime/feature mismatches are treated as explicit typed failures.

## Safe usage guidance

- Prefer `strict` or `agent` profiles for extraction and audit.
- Audit untrusted archives before extraction (`audit` + `assertSafe` paths).
- Set resource limits (`maxEntryBytes`, `maxTotalExtractedBytes`) for hostile inputs.

## Reporting vulnerabilities

Report security issues through GitHub Security Advisories for this repository.

## Disclosure workflow

1. Reproduce and classify impact.
2. Patch with tests.
3. Publish release notes and remediation guidance.
