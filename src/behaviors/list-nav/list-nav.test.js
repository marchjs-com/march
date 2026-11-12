import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "../../core/reactive.ts";
const { moveCursor, listNav } = await import("./index.ts");
const Sel = await import("../../core/selection.ts");
const Forms = await import("../../forms/util.ts");

const key = (k, mods = {}) => { let prevented = false; return { key: k, ctrlKey: false, metaKey: false, ...mods, preventDefault() { prevented = true; }, get prevented() { return prevented; } }; };

test("list-nav: one source — core/selection and forms re-export it", () => {
  assert.equal(Sel.moveCursor, moveCursor);
  assert.equal(Forms.listNav, listNav);
});

test("moveCursor: list and wrapped grid, clamped, RTL swaps left and right, Ctrl+Home / End", () => {
  assert.equal(moveCursor({ key: "ArrowDown", index: 9, count: 10 }), 9);
  assert.equal(moveCursor({ key: "PageDown", index: 0, count: 30, page: 5 }), 5);
  assert.equal(moveCursor({ key: "ArrowRight", index: 0, count: 10 }), null, "a list ignores left / right");
  assert.equal(moveCursor({ key: "ArrowRight", index: 1, count: 9, columns: 3 }), 2);
  assert.equal(moveCursor({ key: "ArrowRight", index: 1, count: 9, columns: 3, rtl: true }), 0);
  assert.equal(moveCursor({ key: "End", index: 3, count: 9, columns: 3 }), 5, "end of the row");
  assert.equal(moveCursor({ key: "End", index: 3, count: 9, columns: 3, ctrl: true }), 8);
  assert.equal(moveCursor({ key: "x", index: 0, count: 3 }), null);
});

test("listNav: loops, pages, Ctrl+Home / End only, Enter picks, closed field opens, onMove", () => {
  const active = signal(-1), picks = [], moves = [];
  let open = false;
  const nav = listNav({ count: () => 20, active, onPick: (i) => picks.push(i), onOpen: () => { open = true; }, isOpen: () => open, page: 8, onMove: (i) => moves.push(i) });
  assert.equal(nav(key("ArrowDown")), true); assert.equal(open, true); assert.equal(active(), -1, "first press opens");
  nav(key("ArrowDown")); assert.equal(active(), 0);
  nav(key("ArrowUp")); assert.equal(active(), 19, "loops up");
  nav(key("ArrowDown")); assert.equal(active(), 0, "loops down");
  nav(key("PageDown")); assert.equal(active(), 8);
  const home = key("Home"); assert.equal(nav(home), false); assert.equal(home.prevented, false, "Home moves the caret");
  nav(key("End", { ctrlKey: true })); assert.equal(active(), 19);
  const enter = key("Enter"); nav(enter); assert.deepEqual(picks, [19]); assert.equal(enter.prevented, true);
  assert.deepEqual(moves, [0, 19, 0, 8, 19]);
  active.set(-1); assert.equal(nav(key("Enter")), false, "nothing highlighted");
  const none = listNav({ count: () => 0, active: signal(-1), onPick: () => {} });
  assert.equal(none(key("ArrowDown")), false);
});
