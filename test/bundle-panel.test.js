import { test } from "node:test";
import assert from "node:assert/strict";
const { marchImports, marchCost } = await import("../examples/showcase/src/playground/bundle-panel.tsx");

test("bundle: the code's March imports (type imports left out), each component's size alone, the whole estimated with the core once", () => {
  const imps = marchImports([`import { Button, Card as Box } from "march/ui"\nimport type { IconType } from "march/icons"\nimport { signal } from "march"`, `import { Button } from "hadi-march/ui"`]);
  assert.deepEqual(imps.map((i) => `${i.from}#${i.name}`), ["march/ui#Button", "march/ui#Card", "march#signal"]);
  const sizes = { base: { min: 100, gzip: 50 }, items: { "march/ui#Button": [300, 80], "march/data#Card": [400, 90] } };
  const c = marchCost(imps, sizes);
  assert.deepEqual(c.rows.map((r) => r.gzip), [80, 90, null], "a name found under another subpath counts; a function is not measured");
  assert.equal(c.total, 50 + 30 + 40, "the core once, then each component's own part");
  assert.equal(marchCost(imps, null).total, null);
});
