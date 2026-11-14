import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const host = document.createElement("div"); document.body.appendChild(host); const dispose = render(fn, host); return { host, dispose }; };
const { NavMenu } = await import("./index.ts");

test("NavMenu: a labelled nav with grouped links and a filter box; filter={false} drops it", () => {
  const items = [{ id: "a", title: "Alpha", href: "/a" }, { id: "b", title: "Beta", href: "/b", group: "G" }];
  const { host, dispose } = mount(() => h(NavMenu, { items, palette: false, storageKey: "t.nav", label: "Main" }));
  assert.ok(host.querySelector(".hm-nav"));
  assert.ok(host.querySelector(".hm-nav-filter input"));
  assert.match(host.textContent, /Alpha/);
  assert.match(host.textContent, /Beta/);
  assert.ok(host.querySelector(".hm-nav-group"));
  dispose();
  const b = mount(() => h(NavMenu, { items, palette: false, storageKey: "t.nav2", filter: false }));
  assert.equal(b.host.querySelector(".hm-nav-filter"), null);
  b.dispose();
});

test("NavMenu: pins off, own texts and icons, chevron and search icon off", () => {
  const items = [{ id: "a", title: "Alpha", href: "/a" }, { id: "b", title: "Beta", href: "/b", group: "G" }];
  const a = mount(() => h(NavMenu, { items, palette: false, storageKey: "t.nav3", pins: false, icons: { chevron: false, search: false, menu: "≡" },
    labels: { filterPlaceholder: "Find…", filter: "Find a page", noMatches: "Nothing", menu: "Open navigation" } }));
  assert.equal(a.host.querySelector(".hm-nav-pin"), null);
  assert.ok(a.host.querySelector(".hm-nav-nopins"));
  assert.equal(a.host.querySelector(".hm-nav-chev"), null);
  assert.equal(a.host.querySelector(".hm-nav-filter-icon"), null);
  const input = a.host.querySelector(".hm-nav-filter input");
  assert.equal(input.getAttribute("placeholder"), "Find…");
  assert.equal(input.getAttribute("aria-label"), "Find a page");
  const burger = a.host.querySelector(".hm-nav-burger");
  assert.equal(burger.getAttribute("aria-label"), "Open navigation");
  assert.equal(burger.textContent, "≡");
  input.value = "zzz"; input.dispatchEvent(new Event("input", { bubbles: true }));
  assert.equal(a.host.querySelector(".hm-nav-none").textContent, "Nothing");
  a.dispose();
  const b = mount(() => h(NavMenu, { items, palette: false, storageKey: "t.nav4", icons: { pin: "☆", pinned: "★" }, labels: { pinned: "Favourites", pin: (x) => `Keep ${x}`, unpin: (x) => `Drop ${x}` } }));
  const pin = b.host.querySelector('[data-pin="a"]');
  assert.equal(pin.getAttribute("aria-label"), "Keep Alpha");
  assert.equal(pin.textContent, "☆");
  assert.ok(b.host.querySelector(".hm-nav-chev"), "the chevron stays by default");
  pin.click();
  assert.equal(b.host.querySelector('[data-pin="a"]').getAttribute("aria-label"), "Drop Alpha");
  assert.equal(b.host.querySelector('[data-pin="a"]').textContent, "★");
  assert.equal(b.host.querySelector(".hm-nav-pinned .hm-nav-heading").textContent, "Favourites");
  b.dispose();
});

test("NavMenu: under the breakpoint the menu leaves the page and opens in a Drawer from the menu button", async () => {
  const mm = globalThis.matchMedia;
  globalThis.matchMedia = (q) => ({ matches: q.includes("max-width: 900px"), media: q, addEventListener() {}, removeEventListener() {} });
  const a = mount(() => h(NavMenu, { items: [{ id: "a", title: "Alpha", href: "/a" }], palette: false, storageKey: "t.nav-narrow", label: "Main", pins: false }));
  globalThis.matchMedia = mm;
  assert.equal(document.querySelector(".hm-nav"), null, "not in the page while closed");
  const burger = a.host.querySelector(".hm-nav-burger");
  assert.equal(burger.getAttribute("aria-expanded"), "false");
  burger.click();
  for (let i = 0; i < 50 && !document.querySelector(".hm-drawer .hm-nav"); i++) await new Promise((r) => setTimeout(r, 10));
  const panel = document.querySelector(".hm-drawer.hm-nav-sheet");
  assert.ok(panel, "the Drawer panel");
  assert.ok(panel.classList.contains("hm-nav-nopins"), "state classes go with the menu");
  assert.equal(panel.getAttribute("aria-label"), "Main");
  assert.match(panel.querySelector(".hm-nav").textContent, /Alpha/);
  assert.equal(burger.getAttribute("aria-expanded"), "true");
  a.dispose();
});
