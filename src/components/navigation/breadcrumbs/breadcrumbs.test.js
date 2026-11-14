import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const { Breadcrumbs } = await import("./index.ts");

test("Breadcrumbs: nav + ordered list, current page, buttons, sibling menus, separators", async () => {
  let went = 0;
  const m = mount(() => h(Breadcrumbs, { label: "File path", items: [
    { id: "hadi", label: "hadi", onSelect: () => went++ },
    { id: "src", label: "src", siblings: [{ id: "docs", label: "docs", onSelect: () => {} }] },
    { id: "app", label: "app.ts" },
  ] }));
  await tick(); await tick();
  const nav = m.el.querySelector("nav");
  assert.equal(nav.getAttribute("aria-label"), "File path");
  const lis = [...nav.querySelectorAll("li")].filter((l) => !l.className.includes("m-bc-more"));
  assert.equal(lis.length, 3);
  assert.equal(lis[2].querySelector('[aria-current="page"]').textContent, "app.ts");
  lis[0].querySelector("button").click();
  assert.equal(went, 1);
  const menuBtn = lis[1].querySelector('button[aria-haspopup="menu"]');
  assert.ok(menuBtn, "a crumb with siblings opens a menu");
  assert.equal(nav.querySelectorAll(".m-bc-sep").length, 3);
  assert.ok(nav.querySelector(".m-bc-more").hidden, "nothing collapsed while it fits");
  m.dispose();
});

test("Breadcrumbs: own separator, no separator, own ellipsis and menu names", async () => {
  const items = [{ id: "a", label: "a" }, { id: "b", label: "b", siblings: [{ id: "c", label: "c", onSelect: () => {} }] }, { id: "d", label: "d" }];
  const m = mount(() => [
    h(Breadcrumbs, { items, separator: "/", ellipsis: "more", labels: { more: "In between", goTo: (name) => `Next to ${name}` } }),
    h(Breadcrumbs, { items, separator: false, collapse: false }),
    h(Breadcrumbs, { items, separator: () => h("i", { class: "own-sep" }) }),
  ]);
  await tick(); await tick();
  const [own, bare, fn] = m.el.querySelectorAll("nav");
  assert.deepEqual([...own.querySelectorAll(".m-bc-sep")].map((s) => s.textContent), ["/", "/", "/"]);
  assert.equal(own.querySelector(".m-bc-more button").textContent, "more");
  assert.equal(own.querySelector(".m-bc-more button").getAttribute("aria-label"), "In between");
  assert.equal(own.querySelectorAll('button[aria-haspopup="menu"]')[1].getAttribute("aria-label"), "Next to b");
  assert.equal(bare.querySelectorAll(".m-bc-sep").length, 0);
  assert.equal(fn.querySelectorAll(".m-bc-sep .own-sep").length, 3);
  m.dispose();
});

test("Breadcrumbs: a sibling with href is a link; the current one is marked; sub adds a second line", async () => {
  const R = await import("../../../router/index.ts");
  R.createRouter({ routes: Object.fromEntries(["/", "/forms", "/data"].map((p) => [p, { component: () => null }])) });
  await R.navigate("/forms");
  let picked = "";
  const m = mount(() => h(Breadcrumbs, { items: [
    { id: "home", label: "Home", href: "/" },
    { id: "forms", label: "Forms", siblings: [
      { id: "/forms", label: "Forms", sub: "Fields and pickers", href: "/forms", current: true },
      { id: "/data", label: "Data", href: "/data", current: false },
      { id: "x", label: "Action", onSelect: () => { picked = "x"; } },
    ] },
  ] }));
  await tick(); await tick();
  const trigger = [...m.el.querySelectorAll('button[aria-haspopup="menu"]')].at(-1); // the first one is the … menu
  trigger.click(); await tick();
  const items = [...document.getElementById(trigger.getAttribute("aria-controls")).querySelectorAll("[role=menuitem]")];
  assert.equal(items.length, 3);
  assert.equal(items[0].tagName, "A");
  assert.ok(items[0].getAttribute("href").endsWith("forms"));
  assert.equal(items[0].getAttribute("aria-current"), "page");
  assert.ok(items[0].classList.contains("is-active"));
  assert.equal(items[0].querySelector(".m-listrow-sub").textContent, "Fields and pickers");
  assert.equal(items[1].getAttribute("aria-current"), null);
  assert.equal(items[2].tagName, "BUTTON");
  items[2].click();
  assert.equal(picked, "x");
  m.dispose();
});
