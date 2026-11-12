// Every exported component has a live demo card and a Playground in the showcase (tools/demo-coverage.mjs): a page card
// (<Demo> with the component inside, a <Playground>/<LitePlayground>/<ComponentDemo>), a component folder's demo.tsx and
// playground.ts, or its API reference example (run + play). Subpaths whose examples are still being written
// (PENDING in tools/api-examples.js) are not checked yet.
import { test } from "node:test";
import assert from "node:assert/strict";
const { coverage } = await import("../tools/demo-coverage.mjs");
const { PENDING } = await import("../tools/api-examples.js");

const open = (list) => list.filter((m) => !PENDING.has(m.split(" › ")[0]));

test("every component has a live demo card", () => {
  assert.deepEqual(open(coverage().noDemo), [], "add a <Demo> card or an API reference example (api-examples/<group>.tsx)");
});

test("every component has a Playground", () => {
  assert.deepEqual(open(coverage().noPlay), [], "give its card a Playground, or its API example a `play` spec");
});
