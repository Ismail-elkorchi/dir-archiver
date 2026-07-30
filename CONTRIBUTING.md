# Contributing

Repository development requires Node.js 24 or newer. The complete cross-runtime
check also requires current Deno and Bun installations.

```sh
npm ci
npm run check
```

`npm run check` runs strict TypeScript checks, ESLint, the Node.js behavior and
security tests, the examples, and offline packed-package tests in Node.js,
Deno, and Bun.

Keep changes focused:

- add a regression test for every bug fix or behavior change;
- update `CONTRACT.md` when a public API, CLI, result, error, or guarantee changes;
- update user documentation and `CHANGELOG.md` for release-relevant changes;
- preserve ESM packaging and Node.js, Deno, and Bun behavior;
- keep archive destinations outside their source directories in examples;
- use a fresh staging directory when demonstrating untrusted extraction.

Run `npm run check` before opening a pull request. CI repeats it on Linux and
runs the Node.js test suite on macOS and Windows for filesystem-sensitive
behavior.
