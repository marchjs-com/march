import { test } from "node:test";
import assert from "node:assert/strict";
const { lineDiff, foldDiff, diffCount, diffText } = await import("../examples/showcase/src/playground/history-panel.tsx");

test("history: a line diff (kept, taken out, put in, with their numbers); folded to the lines near a change", () => {
  const before = "a\nb\nc\nd\ne\nf\ng\nh", after = "a\nb\nC\nd\ne\nf\ng\nh\ni";
  const d = lineDiff(before, after);
  assert.deepEqual(diffCount(d), { added: 2, removed: 1 });
  assert.deepEqual(d.filter((l) => l.op !== " ").map((l) => `${l.op}${l.text}`).sort(), ["+C", "+i", "-c"]);
  assert.ok(d.some((l) => l.op === "-" && l.text === "c" && l.a === 3));
  assert.ok(d.some((l) => l.op === "+" && l.text === "C" && l.b === 3));
  const f = foldDiff(lineDiff("1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12", "1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\nX"), 2);
  assert.equal(f[0], null, "the far kept lines are one gap");
  assert.equal(diffText([{ op: "-", text: "a" }, null, { op: "+", text: "b" }]), "- a\n…\n+ b");
  assert.deepEqual(lineDiff("same", "same").map((l) => l.op), [" "]);
});

test("history rows: the unsaved changes first, then each save against the one before it, the oldest the opening text", async () => {
  const { historyRows } = await import("../examples/showcase/src/playground/history-panel.tsx");
  const list = [{ at: 3, text: "c" }, { at: 2, text: "b" }, { at: 1, text: "a" }];
  const rows = historyRows(list, "d");
  assert.deepEqual(rows.map((r) => [r.k, r.before, r.after]), [[-1, "c", "d"], [0, "b", "c"], [1, "a", "b"], [2, "a", "a"]]);
  assert.equal(historyRows(list, "c")[0].k, 0, "no unsaved row when the text is the last save");
});
