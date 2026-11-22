# Agent instructions

Read [AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md) before writing code with or for March.
Before finishing: `npm run test:changed` (tests that depend on what you changed) and `npx tsc -p tsconfig.json` (types).
`npm test` runs the fast suite (unchanged files come from the cache); `npm run test:release` (every test, the release-only
build tests with the 10 KB chunk rule and budgets, size) runs before merging into main. The site and its examples live
in their own repositories (marchjs-com/marchjs.com, marchjs-com/examples) and check themselves.
Keep the core size budget (`npm run size`). Details: docs/internal/workflow.md (the internal notes: a private repository, checked out into docs/internal/, not part of this one).
