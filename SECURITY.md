# Security policy

## Threat model

Archive inputs are untrusted by default.

Common archive risks include:

- path traversal
- absolute paths
- symlink abuse
- hard-link abuse
- resource exhaustion during decompression or extraction
- runtime or feature mismatches

## Safe usage guidance

For archives from users, uploads, package registries, CI inputs, or external services:

1. Run `audit()` or `dir-archiver audit` before extraction.
2. Use `profile: "strict"` or `profile: "agent"`.
3. Set `maxEntryBytes` and `maxTotalExtractedBytes`.
4. Keep symlink extraction disabled unless your application has a documented reason.
5. Branch on `DirArchiverError.code`, not message text.

API pattern:

```ts
await extract("./incoming.zip", "./out", {
  profile: "strict",
  maxEntryBytes: 64 * 1024 * 1024,
  maxTotalExtractedBytes: 512 * 1024 * 1024,
});
```

CLI pattern:

```sh
dir-archiver extract \
  --input ./incoming.zip \
  --output ./out \
  --profile strict \
  --max-entry-bytes 67108864 \
  --max-total-extracted-bytes 536870912 \
  --json
```

Read [docs/safety.md](docs/safety.md) for complete usage guidance.

## Reporting vulnerabilities

Report security issues through GitHub Security Advisories for this repository.

Do not open a public issue for a suspected vulnerability.

## Disclosure workflow

1. Reproduce and classify impact.
2. Patch with tests.
3. Publish release notes and remediation guidance.
