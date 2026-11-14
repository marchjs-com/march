import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { mProps } = await import("../../../props/index.ts");
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
  const btns = [...bar.querySelectorAll("button.m-react-e")];
  assert.equal(btns.length, 6);
  assert.equal(btns[1].getAttribute("aria-pressed"), "true");
  assert.deepEqual(btns.map((b) => b.getAttribute("tabindex")).filter((x) => x === "0").length, 1);
  btns[1].focus();
  bar.dispatchEvent(Object.assign(new globalThis.Event("keydown", { bubbles: true, cancelable: true }), { key: "ArrowRight" }));
  btns[2].click();
  bar.querySelector(".m-react-more").click();
  assert.deepEqual(picked, ["😮", "+"]);
  m.dispose();
});

test("ReactionPicker: grid layout lists the emoji set", () => {
  const m = mount(() => h(ReactionPicker, { layout: "grid", onPick: () => {} }));
  assert.ok(m.el.querySelectorAll(".m-react-grid button").length > 20);
  m.dispose();
});

test("ReactionPicker: own names, own + content, color", () => {
  const m = mount(() => [
    mProps(h(ReactionPicker, { onPick: () => {}, onMore: () => {}, pop: false, emojis: ["❤️", "👍"], emojiLabel: (e) => (e === "❤️" ? "Heart" : "Thumb"), moreLabel: "All", moreIcon: h("i", { class: "own-more" }), class: "mine" }), { color: "brand-orange" }),
    h(ReactionPicker, { onPick: () => {}, onMore: () => {}, pop: false }),
  ]);
  const [a, b] = m.el.querySelectorAll(".m-react");
  assert.ok(a.classList.contains("mine"));
  assert.equal(a.getAttribute("data-m-color"), "brand-orange");
  assert.deepEqual([...a.querySelectorAll(".m-react-e")].map((x) => x.getAttribute("aria-label")), ["Heart", "Thumb"]);
  assert.equal(a.querySelector(".m-react-more").getAttribute("aria-label"), "All");
  assert.ok(a.querySelector(".m-react-more .own-more") && !a.querySelector(".m-react-more .m-svg"));
  assert.equal(b.getAttribute("data-m-color"), null);
  assert.equal(b.querySelector(".m-react-more").getAttribute("aria-label"), "More emoji");
  m.dispose();
});
