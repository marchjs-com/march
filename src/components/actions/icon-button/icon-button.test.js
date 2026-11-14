import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { mProps } = await import("../../../props/index.ts");
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const tick = () => new Promise((r) => setTimeout(r, 0));
const { IconButton } = await import("./index.ts");

test("IconButton: named, sized, toned; a label is required", () => {
  const m = mount(() => h(IconButton, { icon: "x", label: "Close", size: "sm", variant: "danger", "aria-pressed": "false" }));
  const b = m.el.querySelector("button");
  assert.equal(b.getAttribute("aria-label"), "Close");
  assert.equal(b.getAttribute("title"), "Close");
  assert.equal(b.getAttribute("aria-pressed"), "false");
  for (const c of ["m-icon-btn", "m-btn-sm", "m-icon-btn-danger"]) assert.ok(b.className.includes(c), c);
  m.dispose();
  assert.throws(() => mount(() => h(IconButton, { icon: "x" })), /needs a label/);
});

test("IconButton: colour token; the tooltip can be replaced or turned off", () => {
  const m = mount(() => [
    mProps(h(IconButton, { icon: "x", label: "Close", title: false }), { color: "brand-blue" }),
    h(IconButton, { icon: "x", label: "Close", title: "Close the panel" }),
  ]);
  const [a, b] = m.el.querySelectorAll("button");
  assert.equal(a.getAttribute("data-m-color"), "brand-blue");
  assert.equal(a.hasAttribute("title"), false);
  assert.equal(a.hasAttribute("color"), false);
  assert.equal(a.getAttribute("aria-label"), "Close");
  assert.equal(b.getAttribute("title"), "Close the panel");
  assert.equal(b.getAttribute("data-m-color"), null);
  m.dispose();
});

test("IconButton: xs size, solid / raised, round, inverse, pressed", () => {
  const on = signal(false);
  const m = mount(() => [
    h(IconButton, { icon: "x", label: "Remove", size: "xs", pressed: on }),
    mProps(h(IconButton, { icon: ">", label: "Send", variant: "solid", shape: "round", size: "lg" }), { color: "brand-blue" }),
    h(IconButton, { icon: "^", label: "Top", variant: "raised", shape: "round", inverse: true }),
  ]);
  const [a, b, c] = m.el.querySelectorAll("button");
  assert.ok(a.className.includes("m-btn-xs"));
  assert.equal(a.getAttribute("aria-pressed"), "false");
  on.set(true);
  assert.equal(a.getAttribute("aria-pressed"), "true");
  assert.ok(a.className.includes("is-pressed"));
  for (const k of ["m-icon-btn-solid", "m-icon-btn-round", "m-btn-lg"]) assert.ok(b.className.includes(k), k);
  assert.equal(b.hasAttribute("aria-pressed"), false);
  for (const k of ["m-icon-btn-raised", "m-icon-btn-round", "m-icon-btn-inverse"]) assert.ok(c.className.includes(k), k);
  for (const k of ["shape", "inverse", "pressed"]) assert.equal(c.hasAttribute(k), false, k);
  m.dispose();
});

test("IconButton: href draws a link; children follow the icon", () => {
  const m = mount(() => [
    h(IconButton, { icon: "@", label: "Profile", href: "https://example.com/me", shape: "round" }),
    h(IconButton, { icon: "b", label: "Inbox" }, h("span", { class: "m-badge-count" }, "3")),
  ]);
  const a = m.el.querySelector("a");
  assert.equal(a.getAttribute("href"), "https://example.com/me");
  assert.equal(a.getAttribute("aria-label"), "Profile");
  assert.equal(a.hasAttribute("type"), false);
  assert.ok(a.className.includes("m-icon-btn"));
  const b = m.el.querySelector("button");
  assert.equal(b.querySelector(".m-icon").textContent, "b");
  assert.equal(b.querySelector(".m-badge-count").textContent, "3");
  m.dispose();
});
