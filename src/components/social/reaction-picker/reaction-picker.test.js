import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const { ReactionPicker } = await import("./index.ts");

test("ReactionPicker: toolbar of pressed buttons, one tab stop, arrow keys, pick", () => {
  const picked = [];
  const m = mount(() => h(ReactionPicker, { selected: "😂", onPick: (e) => picked.push(e), onMore: () => picked.push("+") }));
  const bar = m.el.querySelector("[role=toolbar]");
  assert.equal(bar.getAttribute("aria-label"), "Reactions");
  const btns = [...bar.querySelectorAll("button.hm-react-e")];
  assert.equal(btns.length, 6);
  assert.equal(btns[1].getAttribute("aria-pressed"), "true");
  assert.deepEqual(btns.map((b) => b.getAttribute("tabindex")).filter((x) => x === "0").length, 1);
  btns[1].focus();
  bar.dispatchEvent(Object.assign(new globalThis.Event("keydown", { bubbles: true, cancelable: true }), { key: "ArrowRight" }));
  btns[2].click();
  bar.querySelector(".hm-react-more").click();
  assert.deepEqual(picked, ["😮", "+"]);
  m.dispose();
});

test("ReactionPicker: grid layout lists the emoji set", () => {
  const m = mount(() => h(ReactionPicker, { layout: "grid", onPick: () => {} }));
  assert.ok(m.el.querySelectorAll(".hm-react-grid button").length > 20);
  m.dispose();
});
