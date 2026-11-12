import { test } from "node:test";
import assert from "node:assert/strict";
const { signal, createRoot } = await import("../src/core/reactive.ts");
const { createSelection } = await import("../src/core/selection.ts");

test("selection: a narrower mode trims the selection at once (none clears, single keeps the last pick)", () => {
  const mode = signal("multiple");
  const changes = [];
  const [sel, dispose] = createRoot((d) => [createSelection({ items: () => ["a", "b", "c", "d"], mode, onChange: (k) => changes.push(k) }), d]);
  sel.pick("a"); sel.pick("c", { ctrlKey: true });
  assert.deepEqual(sel.keys(), ["a", "c"]);
  mode.set("single");
  assert.deepEqual(sel.keys(), ["c"], "single keeps the anchor");
  mode.set("multiple");
  sel.pick("b", { ctrlKey: true });
  assert.deepEqual(sel.keys(), ["c", "b"]);
  mode.set("none");
  assert.deepEqual(sel.keys(), [], "none clears");
  assert.deepEqual(changes.at(-1), []);
  dispose();
});
