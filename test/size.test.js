import { test } from "node:test";
import assert from "node:assert/strict";
import { sizes, BUDGET } from "../bench/size.js";

test("gzip size budgets (core entry and a minimal counter app)", async () => {
  const s = await sizes(["core"]);
  assert.ok(s.core.gzip <= BUDGET.core, `core ${s.core.gzip} B > ${BUDGET.core} B`);
  assert.ok(s.minimal.gzip <= BUDGET.minimal, `minimal ${s.minimal.gzip} B > ${BUDGET.minimal} B`);
});
