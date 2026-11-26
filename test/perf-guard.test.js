// Speed guard: the DOM work of each keyed-list operation (bench/work.js) may not grow. Counts are exact on every
// machine, so a regression fails CI instead of hiding in timing noise. Each line is a rule from AI_INSTRUCTIONS.md › Speed:
// a row is inserted once, a text node is written once, an unchanged class is not written, a swap moves two rows,
// clearing a list is one step.
import { test } from "node:test";
import assert from "node:assert/strict";
import { listWork } from "../bench/work.js";

test("keyed list: every operation does the least DOM work (1,000 rows)", async () => {
  const n = 1000, w = await listWork(n);
  assert.equal(w.create.rowMoves, n, "create: each row is inserted once (no fragment in between: that would move it twice)");
  assert.equal(w.create.text, 2 * n, "create: each text node is written once (made with its first value)");
  assert.equal(w.create.attr, 0, "create: an empty class is not written");
  assert.equal(w.update.text, n / 10, "update every 10th row: only the changed labels are written");
  assert.equal(w.update.intoTable + w.update.attr + w.update.remove, 0, "update: no row moves, no class writes");
  assert.ok(w.select.attr <= 1 && w.selectNext.attr <= 2, `select: only the rows whose class changes (${w.select.attr}, ${w.selectNext.attr})`);
  assert.equal(w.swap.rowMoves, 2, "swap: the two rows move, nothing else");
  assert.equal(w.swap.text, 0, "swap: no text is rewritten");
  assert.equal(w.remove.remove, 1, "remove one row: one removal");
  assert.equal(w.remove.intoTable, 0, "remove one row: nothing moves");
  assert.equal(w.append.rowMoves, n, "append: only the new rows are inserted, once each");
  assert.equal(w.replace.clear, 1, "replace all: the old rows leave in one step");
  assert.equal(w.replace.rowMoves, n, "replace all: each new row inserted once");
  assert.equal(w.clear.clear, 1, "clear: one step");
  assert.equal(w.rowsLeft, 0, "the table is empty at the end");
});
