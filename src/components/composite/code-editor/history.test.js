import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
installDom({ url: "http://localhost/" });
const { createHistory, diff } = await import("./history.ts");

test("history: a typed word is one step, a space starts the next; undo and redo return the text and the selection", () => {
  const h = createHistory();
  let v = "";
  const type = (ch) => { const next = v + ch; h.record(v, next, [v.length, v.length], [next.length, next.length]); v = next; };
  for (const ch of "let ab") type(ch);
  assert.deepEqual(h.size(), { undo: 3, redo: 0 }, "let · space · ab");
  let r = h.undo(v); v = r.value;
  assert.equal(v, "let ");
  assert.deepEqual(r.sel, [4, 4]);
  r = h.undo(v); v = r.value;
  assert.equal(v, "let");
  r = h.redo(v); v = r.value;
  assert.equal(v, "let ");
  assert.equal(h.undo("something else"), null, "a step that no longer fits the text is dropped, not applied");
});

test("history: Backspaces merge, the limit keeps the newest steps, a new change clears redo", () => {
  const h = createHistory({ limit: 3 });
  h.record("abc", "ab", [3, 3], [2, 2]); h.record("ab", "a", [2, 2], [1, 1]);
  assert.equal(h.size().undo, 1);
  assert.equal(h.undo("a").value, "abc");
  h.record("abc", "abcX", [3, 3], null);
  assert.equal(h.size().redo, 0);
  for (let i = 0; i < 5; i++) h.record(`${i}`, `${i} ${i}`, [0, 0], null);
  assert.equal(h.size().undo, 3, "at most limit steps");
  assert.deepEqual(diff("hello world", "hello brave world"), { at: 6, del: "", ins: "brave " });
});

test("history: with a key it is kept in the session for the same text only", () => {
  const a = createHistory({ key: "k1" });
  a.record("x", "xy", [1, 1], null);
  a.save("xy");
  const b = createHistory({ key: "k1" });
  assert.ok(b.load("xy"));
  assert.equal(b.undo("xy").value, "x");
  const c = createHistory({ key: "k1" });
  assert.ok(!c.load("changed elsewhere"), "another text: not taken back");
});
