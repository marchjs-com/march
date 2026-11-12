# Agent instructions

Read [AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md) before writing code with or for March.
Before finishing: `npm run test:changed` (tests that depend on what you changed) and `node examples/showcase/build.mjs`
(fast build). `npm test` runs the fast suite (unchanged files come from the cache); `npm run test:release` (every
test, the release build with the 10 KB chunk rule and budgets, size, headless checks) runs before merging into main.
Keep the core size budget (`npm run size`). Details: docs/internal/workflow.md.
