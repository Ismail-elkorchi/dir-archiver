# Safety

Archive extraction turns names and bytes controlled by an archive into filesystem writes. Treat an archive as untrusted when it comes from a user, upload, build system, package registry, network URL, or another process with a different trust boundary.

This page describes what `dir-archiver` enforces and what the calling application still has to manage.

## What the wrapper enforces

For every extraction profile, `dir-archiver` performs lexical destination checks before materializing each entry:

- empty entry names are rejected;
- absolute paths are rejected;
- Windows drive-prefixed paths are rejected;
- any path segment equal to `..` is rejected;
- the resolved lexical path must remain beneath the destination root;
- hard-link entries are rejected;
- symlinks are skipped unless explicitly enabled;
- enabled symlink targets must be relative and cannot contain `..`;
- explicit `maxEntryBytes` and `maxTotalExtractedBytes` limits are enforced while entry bytes are read.

Path failures use `DIRARCHIVER_PATH_TRAVERSAL`. Link and profile failures generally use `DIRARCHIVER_UNSUPPORTED_ENTRY`. Extraction byte failures use `DIRARCHIVER_RESOURCE_LIMIT`.

## What the wrapper does not make transactional

Extraction is not an atomic operation.

- The destination directory is created before the strict or agent audit runs.
- Matching files already in the destination are replaced.
- Each regular file is buffered in memory and then written.
- A failure on a later entry can leave earlier files and directories behind.
- The operation does not restore overwritten files.
- Result counts describe completed work; they are not a rollback log.

Do not extract an external archive directly into an application directory, home directory, repository checkout, or other valuable tree.

## Profiles

| Profile | Reader and audit behavior | Extraction behavior |
| --- | --- | --- |
| `strict` | Strict parsing and the current default bytefold limits. Symlink presence is normally reported as a warning. | Runs a pre-extraction audit and rejects a report containing error-severity issues. This is the default. |
| `agent` | Strict parsing, tighter bytefold agent limits, and stronger audit policy. Symlink presence is currently an error. | Calls `assertSafe()` and then audits before entry writes. |
| `compat` | Compatibility-oriented parsing and audit severity. | Skips the wrapper's pre-extraction audit, but still enforces lexical destination containment, link policy, and explicit extraction byte limits. |

`compat` is not “all checks disabled.” It is still a weaker choice because malformed headers, duplicate or colliding names, and other audit findings are not gated before entry writes. Restrict it to inputs whose producer and archive layout are trusted.

## Strict extraction already audits

A separate `audit()` call is not required to activate strict extraction safety:

```js
await extract(input, destination, {
  profile: "strict",
});
```

Strict `extract()` audits before it writes archive entries. Call `audit()` separately when the application needs to inspect, display, store, or approve the report before extraction:

```js
const report = await audit(input, {
  profile: "agent",
});

if (!report.ok) {
  console.error(report.issues);
  return;
}
```

An API audit returns a report even when `ok` is false. The CLI audit command also exits `0` when it successfully returns such a report. See [Use audit as a gate](cli.md#use-audit-as-a-gate).

## Use both kinds of limits

Reader limits and extraction materialization limits protect different phases.

```js
await extract(input, destination, {
  profile: "strict",

  // Applied while the archive is opened, parsed, decompressed, and audited.
  limits: {
    maxInputBytes: 1024 * 1024 * 1024,
    maxEntries: 5_000,
    maxUncompressedEntryBytes: 64 * 1024 * 1024,
    maxTotalUncompressedBytes: 512 * 1024 * 1024,
    maxCompressionRatio: 200,
  },

  // Applied by dir-archiver while regular files are materialized.
  maxEntryBytes: 64 * 1024 * 1024,
  maxTotalExtractedBytes: 512 * 1024 * 1024,
});
```

`maxEntryBytes` is also a memory ceiling for one regular entry because the current extraction implementation buffers that entry before writing it. Choose a value that fits the process memory budget, not only the disk budget.

Agent profile already supplies tighter dependency defaults than strict, but explicit limits make the application's own policy reviewable and independent of dependency defaults.

## Recommended extraction flow

Use a new staging directory beneath a trusted parent, remove it on failure, and publish it only after success.

```js
import { mkdtemp, mkdir, rename, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { audit, extract } from "dir-archiver";

const input = "./incoming.zip";
const trustedParent = resolve("./archive-staging");
const published = join(trustedParent, "published");

await mkdir(trustedParent, { recursive: true });

// Optional decision step: obtain a report before allocating extraction output.
const report = await audit(input, {
  profile: "agent",
  limits: {
    maxEntries: 5_000,
    maxTotalUncompressedBytes: 512 * 1024 * 1024,
  },
});

if (!report.ok) {
  throw new Error(`Archive rejected: ${JSON.stringify(report.issues)}`);
}

const staging = await mkdtemp(join(trustedParent, ".extract-"));

try {
  await extract(input, staging, {
    profile: "strict",
    maxEntryBytes: 64 * 1024 * 1024,
    maxTotalExtractedBytes: 512 * 1024 * 1024,
  });

  // published must not already exist. A successful rename exposes the complete
  // staged tree instead of a partly extracted one.
  await rename(staging, published);
} catch (error) {
  await rm(staging, { recursive: true, force: true });
  throw error;
}
```

The application should choose a unique `published` path or handle replacement separately. Replacing an existing published tree safely requires an application-specific deployment strategy.

## Destination-directory rules

Lexical containment checks cannot make an arbitrary pre-existing filesystem tree safe.

A path such as `destination/cache/file.txt` is lexically inside the destination, but a pre-existing `destination/cache` symlink can redirect the operating-system write elsewhere. Use a newly created directory beneath a trusted parent and do not let another process modify it during extraction.

Also apply ordinary filesystem isolation where appropriate:

- run the worker with the minimum operating-system privileges it needs;
- use a dedicated temporary or sandbox directory;
- enforce storage quotas outside the process;
- avoid shared writable parents controlled by other users;
- do not extract over application configuration or executable files.

## Symlinks

The default is to skip symlink entries:

```js
const result = await extract(input, destination, {
  profile: "strict",
});

console.log(result.skippedEntries);
```

With strict profile, symlink presence is normally an audit warning, so an explicitly allowed safe relative target can be materialized:

```js
await extract(trustedInput, destination, {
  profile: "strict",
  allowSymlinks: true,
});
```

Only enable this for an archive layout and destination that the application controls. Created symlinks do not have a dedicated count in `ExtractResult`.

Agent profile currently treats symlink presence as an audit error. `allowSymlinks: true` changes the materialization policy; it does not override an agent audit failure.

Hard links are rejected in v3 regardless of `allowHardlinks`.

## Path examples that are rejected

```txt
../outside.txt
nested/../../outside.txt
/absolute/path.txt
C:/absolute/path.txt
```

Backslashes are normalized before the checks, so Windows-style traversal is also rejected.

## Passwords and remote inputs

- Do not log archive passwords or include them in CLI arguments; the current CLI does not expose a password flag.
- HTTP and HTTPS inputs add network, redirect, range-request, and availability failure modes.
- Apply request timeouts and cancellation with `AbortSignal` in the surrounding application.
- In Deno, grant `--allow-net` only for the hosts the worker needs.

## Error handling

Known wrapper failures can be handled by stable package code:

```js
try {
  await extract(input, destination, options);
} catch (error) {
  if (error instanceof DirArchiverError) {
    switch (error.code) {
      case "DIRARCHIVER_PATH_TRAVERSAL":
      case "DIRARCHIVER_UNSUPPORTED_ENTRY":
        // Treat the archive as rejected by policy.
        break;
      case "DIRARCHIVER_RESOURCE_LIMIT":
        // Inspect the archive and policy before changing limits.
        break;
      default:
        // Handle other package codes.
        break;
    }
  } else {
    // Native filesystem, network, cancellation, and dependency errors can
    // surface without a DirArchiverError wrapper.
    throw error;
  }
}
```

Always remove the staging directory after any failure, including non-package errors.

## Checklist

Before extracting an external archive:

- use `strict` or `agent`;
- set reader and materialization limits for the application's budget;
- use a new staging directory under a trusted parent;
- keep the destination free of pre-existing symlinked components;
- do not share the staging path with another writer;
- inspect `audit().ok` when running a separate audit;
- remove partial output on every failure;
- publish or rename only after extraction succeeds;
- handle both `DirArchiverError` and other operational errors.

## Related pages

- [API: audit](api.md#audit)
- [API: extract](api.md#extract)
- [CLI: audit](cli.md#audit)
- [CLI: extract](cli.md#extract)
- [Formats](formats.md)
- [Troubleshooting](troubleshooting.md)
- [Security policy](../SECURITY.md)
