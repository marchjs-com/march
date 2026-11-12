# Contributing to HADI March

- Zero runtime dependencies. The only dev dependency is esbuild.
- Every feature ships with tests (`npm test` runs `node --test` with the tiny DOM in `src/testing/dom.js`), docs in
  `docs/`, an entry in `CHANGELOG.md`, and — when it changes how code should be written — an update to `AI_INSTRUCTIONS.md`.
- Keep the core small: `npm run size` must stay within the budgets in `bench/size.js`. New features go into separate
  modules (`src/<module>/index.js`) unless every app needs them.
- Identifiers in English, user-facing text via i18n. Variables, constants, functions, components, props, types, signals,
  CSS classes and custom properties, file names, route paths, ids and code comments are English; text a user reads goes
  through `t`…`` and the locale packs (`src/i18n/*.ts`). `test/identifiers.test.js` (tools/lint-identifiers.mjs) fails on
  Turkish identifiers, including example code in the showcase.
- Security rules are not negotiable: no HTML strings, no `eval`/`new Function`, no inline styles, sanitized URLs.
- Library source is plain JavaScript calling `h()`; JSX is for apps and examples.
- Versioning follows [semver](https://semver.org/). Breaking changes need a major version and a migration note.
- Commit messages: imperative, short subject, body explains why.
