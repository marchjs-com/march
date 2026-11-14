import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { ClampText } = await import("./index.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const tick = () => new Promise((r) => setTimeout(r, 0));

test("ClampText: folds to the line count; no switch while the text fits", async () => {
  const lines = signal(2);
  const [el, dispose] = mount(() => h(ClampText, { lines }, "Short"));
  const p = el.querySelector("p.m-clamp-text");
  assert.ok(p.classList.contains("is-clamped"));
  assert.equal(p.style.getPropertyValue("--m-clamp-lines"), "2");
  await tick();
  assert.equal(el.querySelector("button"), null, "the fake DOM has no layout: nothing overflows");
  lines.set(0);
  assert.ok(!p.classList.contains("is-clamped"));
  dispose();
});

test("ClampText: the switch opens and folds (uncontrolled), with aria and own texts", () => {
  const seen = [];
  const [el, dispose] = mount(() => h(ClampText, { lines: 3, expandable: "always", text: "Long text", labels: { more: "read on" }, onOpenChange: (o) => seen.push(o), color: "brand-orange", as: "div" }));
  const text = el.querySelector("div.m-clamp-text");
  let btn = el.querySelector("button.m-clamp-toggle");
  assert.equal(btn.textContent, "read on");
  assert.equal(btn.getAttribute("aria-expanded"), "false");
  assert.equal(btn.getAttribute("aria-controls"), text.id);
  assert.equal(el.querySelector(".m-clamp").getAttribute("data-m-color"), "brand-orange");
  btn.click();
  assert.ok(!text.classList.contains("is-clamped"));
  btn = el.querySelector("button.m-clamp-toggle");
  assert.equal(btn.textContent, "less");
  assert.equal(btn.getAttribute("aria-expanded"), "true");
  btn.click();
  assert.ok(text.classList.contains("is-clamped"));
  assert.deepEqual(seen, [true, false]);
  dispose();
});

test("ClampText: controlled open, collapsible={false}, expandable={false}", () => {
  const open = signal(false), calls = [];
  const [el, dispose] = mount(() => [
    h(ClampText, { class: "one", expandable: "always", collapsible: false, open, onOpenChange: (o) => calls.push(o) }, "Text"),
    h(ClampText, { class: "two", expandable: false }, "Text"),
  ]);
  const one = el.querySelector(".one");
  one.querySelector("button").click();
  assert.deepEqual(calls, [true]);
  assert.ok(one.querySelector(".m-clamp-text").classList.contains("is-clamped"), "controlled: stays folded until the owner opens it");
  open.set(true);
  assert.ok(!one.querySelector(".m-clamp-text").classList.contains("is-clamped"));
  assert.equal(one.querySelector("button"), null, "no \"less\" when not collapsible");
  assert.equal(el.querySelector(".two button"), null);
  assert.ok(el.querySelector(".two .m-clamp-text").classList.contains("is-clamped"));
  dispose();
});
