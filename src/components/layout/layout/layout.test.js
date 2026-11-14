import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const host = document.createElement("div"); document.body.appendChild(host); const dispose = render(fn, host); return { host, dispose }; };
const L = await import("./index.ts");
const { Layout, defineLayout, defineLayoutFeature, useLayout } = L;
const { cornerControls } = await import("../bottom-right-controls/index.ts");

test("Layout: without regions it adds no frame; with regions it draws header, nav, main, aside, footer", () => {
  const a = mount(() => h(Layout, { features: [] }, "PAGE"));
  assert.equal(a.host.querySelector(".hm-shell"), null);
  assert.equal(a.host.textContent, "PAGE");
  a.dispose();
  const b = mount(() => h(Layout, { features: [], header: "H", nav: "N", aside: "A", footer: "F", mainId: "m" }, "PAGE"));
  const q = (s) => b.host.querySelector(s);
  assert.equal(q("header.hm-shell-header").textContent, "H");
  assert.equal(q("aside.hm-shell-nav").textContent, "N");
  assert.equal(q("aside.hm-layout-aside").textContent, "A");
  assert.equal(q("footer.hm-layout-footer").textContent, "F");
  assert.equal(q("main#m").textContent, "PAGE");
  assert.equal(q(".hm-skip").getAttribute("href"), "#m");
  assert.match(q(".hm-shell").getAttribute("class"), /hm-layout-has-aside/);
  b.dispose();
});

test("Layout: features by name — defaults on, a config toggles and sets options, a list replaces; they stop with the layout", () => {
  const log = [];
  const ping = defineLayoutFeature("ping", (o) => () => { log.push(`on:${o.tag ?? ""}`); return () => log.push("off"); });
  const Base = defineLayout({ features: { ping: true } });
  const a = mount(() => h(Base, {}, "x"));
  assert.deepEqual(log, ["on:"]);
  a.dispose();
  assert.deepEqual(log, ["on:", "off"]);
  log.length = 0;
  const b = mount(() => h(Base, { features: { ping: { tag: "t" } } }, "x"));
  assert.deepEqual(log, ["on:t"], "options");
  b.dispose(); log.length = 0;
  const c = mount(() => h(Base, { features: { ping: false } }, "x"));
  assert.deepEqual(log, [], "off by name");
  c.dispose();
  const d = mount(() => h(Base, { features: [] }, "x"));
  assert.deepEqual(log, [], "a list replaces the defaults");
  d.dispose();
});

test("Layout.extend: regions override, features merge by name", () => {
  const seen = [];
  defineLayoutFeature("one", () => () => { seen.push("one"); });
  defineLayoutFeature("two", () => () => { seen.push("two"); });
  const A = defineLayout({ header: "A", features: { one: true } });
  const B = A.extend({ header: "B", footer: "F", features: { two: true } });
  const m = mount(() => h(B, {}, "x"));
  assert.equal(m.host.querySelector("header").textContent, "B");
  assert.equal(m.host.querySelector("footer").textContent, "F");
  assert.deepEqual(seen.sort(), ["one", "two"]);
  m.dispose();
});

test("Layout API: corners, slot content swapped while a part is shown, features listed and disabled by name", () => {
  let api;
  const show = signal(true);
  const Part = () => { const a = useLayout(); a.set("aside", "FILTERS"); a.add("bottom-start", Object.assign(document.createElement("i"), { textContent: "c" })); return "part"; };
  const m = mount(() => h(Layout, { features: [], aside: "TOC", corners: { "top-end": Object.assign(document.createElement("b"), { textContent: "S" }) } },
    () => { api = useLayout(); return show() ? h(Part, {}) : "none"; }));
  const aside = m.host.querySelector(".hm-layout-aside");
  assert.equal(aside.textContent, "FILTERS");
  assert.equal(cornerControls("top-end").textContent, "S");
  assert.ok(cornerControls("bottom-start").querySelector("i"), "the part's corner control");
  assert.ok(cornerControls("bottom-start").querySelector(".hm-layout-aside-btn"), "an aside brings its narrow-screen sheet button");
  show.set(false);
  assert.equal(aside.textContent, "TOC", "restored when the part goes away");
  assert.equal(cornerControls("bottom-start").querySelector("i"), null);
  const f = Object.assign(() => () => {}, { featureName: "demo" });
  api.use(f);
  assert.ok(api.features().includes("demo"));
  api.disable("demo");
  assert.ok(!api.features().includes("demo"));
  m.dispose();
  assert.equal(cornerControls("top-end").textContent, "", "corner content leaves with the layout");
});

test("Layout: the default has back-to-top and route focus; Page under it writes the title and adds its corners", async () => {
  assert.deepEqual(Object.keys(Layout.defaults.features).sort(), ["routeFocus", "scrollToTop"]);
  const { Page } = await import("../../../ui/layout.ts");
  const Base = defineLayout({ features: [], titleTemplate: "%s · HADİ" });
  const m = mount(() => h(Base, {}, h(Page, { title: "Kullanıcılar", corners: { "bottom-end": Object.assign(document.createElement("u"), { textContent: "P" }) } }, "body")));
  assert.equal(document.title, "Kullanıcılar · HADİ");
  assert.match(cornerControls("bottom-end").textContent, /P/);
  m.dispose();
  assert.doesNotMatch(cornerControls("bottom-end").textContent, /P/);
  const Narrow = Page.extend({ narrow: true });
  const n = mount(() => h(Base, {}, h(Narrow, { title: "Ayarlar" }, "b")));
  assert.match(n.host.querySelector(".hm-page").getAttribute("class"), /hm-page-narrow/);
  n.dispose();
  const solo = mount(() => h(Page, { title: "Tek", features: [] }, "b"));
  assert.ok(solo.host.querySelector(".hm-layout"), "a Page on its own brings a Layout");
  solo.dispose();
});

test("Layout: a nested Layout does not start the page-wide features its outer Layout already runs", () => {
  let n = 0;
  defineLayoutFeature("once", () => () => { n++; });
  const Outer = defineLayout({ features: { once: true } });
  const m = mount(() => h(Outer, {}, h(Outer, {}, "inner")));
  assert.equal(n, 1);
  m.dispose();
});

test("Layout features: connection badge while offline, aside sheet toggles, dev overlay on Alt+Shift+L, feedback button", () => {
  const { connectionFeature: connection, devOverlayFeature: devOverlay, feedbackFeature: feedback } = L;
  const nav = globalThis.navigator;
  const desc = Object.getOwnPropertyDescriptor(nav, "onLine");
  Object.defineProperty(nav, "onLine", { configurable: true, get: () => false });
  const m = mount(() => h(Layout, { features: [connection(), devOverlay(), feedback({ label: "Görüş" })], aside: "TOC" }, "x"));
  const badge = cornerControls("top-end").querySelector(".hm-offline");
  assert.ok(badge && !badge.hasAttribute("hidden"), "offline badge shown");
  assert.equal(badge.getAttribute("role"), "status");
  const btn = cornerControls("bottom-start").querySelector(".hm-layout-aside-btn");
  const aside = m.host.querySelector(".hm-layout-aside");
  btn.click();
  assert.ok(aside.hasAttribute("data-open"));
  assert.equal(btn.getAttribute("aria-expanded"), "true");
  globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  assert.ok(!aside.hasAttribute("data-open"), "Esc closes the sheet");
  globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "L", altKey: true, shiftKey: true }));
  assert.ok(document.documentElement.hasAttribute("data-hm-layout-debug"));
  assert.match(document.querySelector(".hm-layout-dev").textContent, /connection/);
  assert.ok([...cornerControls("bottom-end").querySelectorAll(".hm-layout-feedback")].some((b) => b.textContent === "Görüş"));
  m.dispose();
  assert.ok(!document.documentElement.hasAttribute("data-hm-layout-debug"));
  if (desc) Object.defineProperty(nav, "onLine", desc); else delete nav.onLine;
});

test("Layout: its own texts and parts — labels, skip link off, aside button off, feature texts and colour token", () => {
  const { connectionFeature: connection, readingProgressFeature: readingProgress } = L;
  const nav = globalThis.navigator;
  const desc = Object.getOwnPropertyDescriptor(nav, "onLine");
  Object.defineProperty(nav, "onLine", { configurable: true, get: () => false });
  const m = mount(() => h(Layout, { features: [connection({ label: "No connection" }), readingProgress({ color: "brand-orange", label: "Article progress" })],
    aside: "TOC", labels: { skip: "Jump", panel: () => "Contents" } }, "x"));
  assert.equal(m.host.querySelector(".hm-skip").textContent, "Jump");
  assert.equal(cornerControls("bottom-start").querySelector(".hm-layout-aside-btn").textContent, "Contents");
  assert.equal(cornerControls("top-end").querySelector(".hm-offline").textContent, "No connection");
  const bar = document.querySelector(".hm-reading-progress");
  assert.equal(bar.getAttribute("aria-label"), "Article progress");
  assert.equal(bar.getAttribute("data-hm-color"), "brand-orange");
  assert.equal(bar.style.getPropertyValue("--hm-rp-c"), "");
  m.dispose();
  const raw = mount(() => h(Layout, { features: [readingProgress({ color: "rebeccapurple" })] }, "x"));
  const b2 = document.querySelector(".hm-reading-progress");
  assert.equal(b2.style.getPropertyValue("--hm-rp-c"), "rebeccapurple", "a CSS color still works");
  assert.equal(b2.hasAttribute("data-hm-color"), false);
  raw.dispose();
  const Quiet = Layout.extend({ skipLink: false, asideToggle: false });
  const q = mount(() => h(Quiet, { features: [], aside: "TOC" }, "x"));
  assert.equal(q.host.querySelector(".hm-skip"), null);
  assert.equal(cornerControls("bottom-start").querySelector(".hm-layout-aside-btn"), null);
  assert.ok(q.host.querySelector(".hm-layout-aside"));
  q.dispose();
  if (desc) Object.defineProperty(nav, "onLine", desc); else delete nav.onLine;
});
