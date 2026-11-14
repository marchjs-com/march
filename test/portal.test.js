// Portals: named targets (order, cleanup, late targets, context stays with the source) and the layer stack (z order,
// inert background under a modal layer, toasts above).
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/dom.ts";

installDom();
const { h, render, signal, context, useContext } = await import("../src/index.ts");
const { Portal, PortalTarget, openLayer, layers } = await import("../src/dom/portal.ts");
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));
const mount = (fn) => { const host = document.createElement("div"); document.body.appendChild(host); const dispose = render(fn, host); return { host, done: () => { dispose(); host.remove(); } }; };
const text = (el) => [...el.querySelectorAll("b")].map((b) => b.textContent).join(",");

test("named target: several sources sorted by order; a source that goes away leaves the target", async () => {
  const showB = signal(true);
  const a = mount(() => [
    h(PortalTarget, { name: "toolbar", class: "tb" }),
    h(Portal, { to: "toolbar", order: 20 }, h("b", {}, "c")),
    () => (showB() ? h(Portal, { to: "toolbar", order: 10 }, h("b", {}, "b")) : null),
    h(Portal, { to: "toolbar", order: 0 }, h("b", {}, "a")),
  ]);
  await tick();
  const tb = a.host.querySelector(".tb");
  assert.equal(text(tb), "a,b,c", "sorted by order");
  showB.set(false); await tick();
  assert.equal(text(tb), "a,c", "cleaned up with its source");
  a.done();
  assert.equal(document.querySelectorAll("b").length, 0, "nothing left anywhere");
});

test("a target that arrives later receives the waiting content; when it goes the content waits again", async () => {
  const hasTarget = signal(false);
  const a = mount(() => [
    h(Portal, { to: "aside" }, h("b", { class: "x" }, "late")),
    () => (hasTarget() ? h(PortalTarget, { name: "aside", class: "side" }) : null),
  ]);
  await tick();
  assert.equal(document.querySelector(".x")?.isConnected ?? false, false, "waits while there is no target");
  hasTarget.set(true); await tick();
  assert.equal(a.host.querySelector(".side .x")?.textContent, "late", "moved in");
  const node = a.host.querySelector(".x");
  hasTarget.set(false); await tick();
  assert.equal(node.isConnected, false, "waiting again");
  hasTarget.set(true); await tick();
  assert.equal(a.host.querySelector(".side .x"), node, "the same node (state kept) moves into the new target");
  a.done();
});

test("context and reactivity stay with the source", async () => {
  const Theme = context("light");
  const n = signal(1);
  const Reader = () => h("b", { class: "ctx" }, () => `${useContext(Theme)} ${n()}`);
  const a = mount(() => [h(PortalTarget, { name: "t2" }), h(Theme.Provider, { value: "dark" }, h(Portal, { to: "t2" }, h(Reader, {})))]);
  await tick();
  assert.equal(document.querySelector(".ctx").textContent, "dark 1");
  n.set(2); await tick();
  assert.equal(document.querySelector(".ctx").textContent, "dark 2");
  a.done();
});

test("layer stack: last opened on top; a modal layer makes the page and lower layers inert; closing restores", async () => {
  const page = document.createElement("main"); document.body.appendChild(page);
  const pop = openLayer("popover", h("div", { class: "p1" }));
  assert.equal(page.hasAttribute("inert"), false, "a popover is not modal");
  const dlg = openLayer("dialog", h("div", { class: "d1" }));
  const pop2 = openLayer("menu", h("div", { class: "p2" }));
  const toast = openLayer("toast", h("div", { class: "t1" }));
  const ls = layers();
  assert.deepEqual(ls.map((l) => l.kind), ["popover", "dialog", "menu", "toast"]);
  const z = ls.map((l) => l.el.style.getPropertyValue("z-index"));
  assert.match(z[0], /100.*\+ 0/); assert.match(z[2], /100.*\+ 2/); assert.match(z[3], /200/);
  assert.equal(page.hasAttribute("inert"), true, "page inert under the dialog");
  assert.equal(ls[0].el.hasAttribute("inert"), true, "the popover under the dialog is inert");
  assert.equal(ls[2].el.hasAttribute("inert"), false, "the menu opened from the dialog is not");
  assert.equal(ls[3].el.hasAttribute("inert"), false, "toasts stay usable");
  dlg();
  assert.equal(page.hasAttribute("inert"), false, "closing the dialog restores the page");
  assert.equal(ls[0].el.hasAttribute("inert"), false);
  pop(); pop2(); toast(); page.remove();
  assert.equal(layers().length, 0);
});

test("Portal layer: renders into the stack and closes with its owner", async () => {
  const open = signal(true);
  const a = mount(() => () => (open() ? h(Portal, { layer: "dialog" }, h("b", { class: "in-layer" }, "hi")) : null));
  await tick();
  assert.equal(document.querySelector(".m-layer[data-layer=dialog] .in-layer")?.textContent, "hi");
  open.set(false); await tick();
  assert.equal(document.querySelector(".in-layer"), null);
  assert.equal(layers().length, 0);
  a.done();
});

test("no component appends to document.body itself (layers and portals only)", async () => {
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const bad = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.ts$/.test(f) && !/dom[\\/]portal\.ts$|testing[\\/]/.test(p) && /\bbody\.(append|appendChild|prepend)\(/.test(readFileSync(p, "utf8"))) bad.push(p); } };
  walk(new URL("../src", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
  assert.deepEqual(bad, []);
});
