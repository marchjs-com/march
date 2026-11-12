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
    { id: "acme", label: "acme", onSelect: () => went++ },
    { id: "src", label: "src", siblings: [{ id: "docs", label: "docs", onSelect: () => {} }] },
    { id: "app", label: "app.ts" },
  ] }));
  await tick(); await tick();
  const nav = m.el.querySelector("nav");
  assert.equal(nav.getAttribute("aria-label"), "File path");
  const lis = [...nav.querySelectorAll("li")].filter((l) => !l.className.includes("hm-bc-more"));
  assert.equal(lis.length, 3);
  assert.equal(lis[2].querySelector('[aria-current="page"]').textContent, "app.ts");
  lis[0].querySelector("button").click();
  assert.equal(went, 1);
  const menuBtn = lis[1].querySelector('button[aria-haspopup="menu"]');
  assert.ok(menuBtn, "a crumb with siblings opens a menu");
  assert.equal(nav.querySelectorAll(".hm-bc-sep").length, 3);
  assert.ok(nav.querySelector(".hm-bc-more").hidden, "nothing collapsed while it fits");
  m.dispose();
});
