import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { rovingFocus } = await import("./index.ts");
const { focus } = await import("../../managers/focus/index.ts");

const btns = (host, ...names) => names.map((n) => { const b = document.createElement("button"); b.textContent = n.replace("!", ""); if (n.endsWith("!")) b.disabled = true; host.appendChild(b); return b; });
const key = (el, k) => { const e = new Event("keydown", { bubbles: true, cancelable: true }); e.key = k; el.dispatchEvent(e); return e; };

test("rovingFocus: one Tab stop, arrows move and wrap, disabled skipped, stop() ends it", () => {
  const bar = document.createElement("div");
  const [a, , c, d] = btns(bar, "a", "b!", "c", "d");
  document.body.appendChild(bar);
  const moves = [];
  const stop = rovingFocus(bar, { orientation: "horizontal", onMove: (el) => moves.push(el.textContent) });
  assert.deepEqual([a, c, d].map((x) => x.getAttribute("tabindex")), ["0", "-1", "-1"]);
  a.focus(); key(a, "ArrowRight");
  assert.equal(document.activeElement, c, "disabled skipped");
  key(c, "End"); key(d, "ArrowRight");
  assert.equal(document.activeElement, a, "wraps");
  assert.deepEqual(moves, ["c", "d", "a"]);
  assert.equal(a.getAttribute("tabindex"), "0");
  stop(); key(a, "ArrowRight");
  assert.equal(document.activeElement, a);
  bar.remove();
});

test("rovingFocus: the FocusManager's roving is this behavior", () => {
  const list = document.createElement("div");
  const [x, y] = btns(list, "x", "y");
  document.body.appendChild(list);
  const stop = focus.roving(list);
  x.focus(); key(x, "ArrowDown");
  assert.equal(document.activeElement, y);
  stop(); list.remove();
});
