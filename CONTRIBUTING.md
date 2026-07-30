# Contributing

Repository development requires Node.js 24 or newer. The complete cross-runtime
check also requires Deno and Bun.

```sh
npm ci
npm run check
```

`npm run check` runs strict TypeScript checks, ESLint, the Node.js behavior and
security tests, the examples, and offline packed-package tests in Node.js,
Deno, and Bun.

For behavior changes:

- add a regression test for every bug fix or behavior change;
- update the relevant public guide and `BREAKING_CHANGES.md` when the public
  contract changes;
- update `CHANGELOG.md` for release-relevant changes;
- preserve ESM packaging and Node.js, Deno, and Bun behavior;
- use a fresh staging directory when demonstrating untrusted extraction.

CI runs the complete check on Linux and filesystem-sensitive behavior tests on
macOS and Windows.
