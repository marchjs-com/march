// ViewportManager: one lazy matchMedia per query, breakpoints, flags, when: props, container sizes, dispose/configure.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
// a controllable matchMedia: set(query, bool) fires "change" on every listener of that query
const mq = new Map();
const calls = [];
globalThis.matchMedia = (q) => {
  calls.push(q);
  let e = mq.get(q);
  if (!e) { e = { matches: false, media: q, fns: new Set(), addEventListener(_t, f) { this.fns.add(f); }, removeEventListener(_t, f) { this.fns.delete(f); } }; mq.set(q, e); }
  return e;
};
const setMq = (q, v) => { const e = mq.get(q) ?? globalThis.matchMedia(q); e.matches = v; for (const f of e.fns) f(); };
const width = (w) => batch(() => { for (const [px, ] of [[640], [768], [1024], [1280], [1536]]) setMq(`(min-width: ${px}px)`, w >= px); });

const { h, render, effect, batch } = await import("../../index.ts");
const { viewport, configureViewport, disposeViewport, viewportManager } = await import("./index.ts");
const { onManager } = await import("../manager.ts");
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

test("lazy: nothing listens until a signal is read; one matchMedia per query", () => {
  disposeViewport();
  calls.length = 0;
  const vp = viewport();
  assert.equal(calls.length, 0, "creating the manager calls nothing");
  vp.dark(); vp.dark(); vp.media("(prefers-color-scheme: dark)");
  assert.deepEqual(calls, ["(prefers-color-scheme: dark)"], "one query object, cached");
  assert.equal(viewport(), vp, "a single instance");
});

test("breakpoints, mobile/tablet/desktop and reactive updates", () => {
  disposeViewport();
  width(375);
  const vp = viewport();
  const seen = [];
  const stop = effect(() => seen.push(vp.breakpoint()));
  assert.equal(vp.breakpoint(), "xs");
  assert.ok(vp.mobile() && !vp.tablet() && !vp.desktop());
  width(800);
  assert.equal(vp.breakpoint(), "md");
  assert.ok(vp.tablet() && vp.up("sm") && vp.down("lg"));
  width(1300);
  assert.ok(vp.desktop() && vp.up("xl") && !vp.up("xxl"));
  assert.deepEqual(seen, ["xs", "md", "xl"]);
  assert.throws(() => vp.up("huge"), /unknown breakpoint/);
  stop();
});

test("preference, pointer, orientation, online and visibility signals", () => {
  disposeViewport();
  const vp = viewport();
  assert.equal(vp.reducedMotion(), false);
  setMq("(prefers-reduced-motion: reduce)", true);
  assert.equal(vp.reducedMotion(), true);
  assert.equal(vp.pointer(), "none");
  setMq("(pointer: fine)", true);
  assert.equal(vp.pointer(), "fine");
  setMq("(pointer: coarse)", true);
  assert.ok(vp.touch() && vp.pointer() === "coarse");
  setMq("(orientation: portrait)", true);
  assert.equal(vp.orientation(), "portrait");
  assert.equal(vp.reducedData(), false);
  setMq("(prefers-reduced-data: reduce)", true);
  assert.equal(vp.reducedData(), true);

  const nav = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
  disposeViewport();
  const v2 = viewport();
  assert.equal(v2.online(), true);
  globalThis.navigator.onLine = false;
  window.dispatchEvent(new Event("offline"));
  assert.equal(v2.online(), false);
  document.visibilityState = "visible";
  assert.equal(v2.visible(), true);
  document.visibilityState = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(v2.visible(), false);
  Object.defineProperty(globalThis, "navigator", { value: nav, configurable: true });
  document.visibilityState = "visible";
});

test("when: props hide and show elements; a typo throws", async () => {
  disposeViewport();
  width(375);
  setMq("(prefers-color-scheme: dark)", false);
  const host = document.createElement("div");
  const off = render(() => [
    h("p", { id: "m", "when:mobile": true }, "phone"),
    h("p", { id: "d", "when:desktop": true }, "desk"),
    h("p", { id: "nd", "when:dark": false }, "light only"),
    h("p", { id: "lg", "when:lg": true }, "lg+"),
  ], host);
  const $ = (id) => host.querySelector(`#${id}`);
  assert.equal($("m").hidden, false);
  assert.equal($("d").hidden, true);
  assert.equal($("nd").hidden, false);
  width(1100);
  setMq("(prefers-color-scheme: dark)", true);
  assert.equal($("m").hidden, true);
  assert.equal($("d").hidden, false);
  assert.equal($("lg").hidden, false);
  assert.equal($("nd").hidden, true);
  assert.throws(() => render(() => h("p", { "when:phablet": true }), document.createElement("div")), /not a viewport flag/);
  off();
  await tick();
});

test("configure: custom breakpoints and dark source; bindings follow the new instance; events", () => {
  disposeViewport();
  const events = [];
  const prev = onManager("*", (e) => events.push(`${e.manager}:${e.type}`));
  let appDark = false;
  setMq("(prefers-color-scheme: dark)", false);
  const seen = [];
  const stop = effect(() => seen.push(viewport().dark()));
  setMq("(prefers-color-scheme: dark)", true);
  configureViewport({ dark: () => appDark, breakpoints: { small: 0, big: 900 }, mobile: "big", desktop: "big" });
  assert.equal(viewport().dark(), false, "the app theme decides now");
  assert.deepEqual(seen, [false, true, false]);
  setMq("(min-width: 900px)", true);
  assert.equal(viewport().breakpoint(), "big");
  assert.ok(viewport().desktop());
  assert.ok(events.includes("viewport:change") && events.includes("viewport:dispose") && events.includes("viewport:start"));
  stop();
  prev();
  configureViewport({ dark: null, breakpoints: viewportManager.config().breakpoints, mobile: "md", desktop: "lg" });
  configureViewport({ breakpoints: { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280, xxl: 1536 } });
});

test("dispose removes every listener", () => {
  disposeViewport();
  const vp = viewport();
  vp.reducedMotion();
  const e = mq.get("(prefers-reduced-motion: reduce)");
  const before = e.fns.size;
  assert.ok(before >= 1);
  disposeViewport();
  assert.equal(e.fns.size, before - 1);
  assert.equal(viewportManager.alive(), false);
});

test("container(): size classes from a ResizeObserver, written to data-m-bp", () => {
  disposeViewport();
  let cb = null, disconnected = false;
  globalThis.ResizeObserver = class { constructor(f) { cb = f; } observe() {} disconnect() { disconnected = true; } };
  const host = document.createElement("div");
  let size;
  const off = render(() => { const el = h("div", {}); size = viewport().container(el); return el; }, host);
  const el = host.querySelector("div");
  assert.equal(size.name(), "xs");
  cb([{ contentRect: { width: 600 } }]);
  assert.equal(size.name(), "md");
  assert.equal(el.getAttribute("data-m-bp"), "md");
  assert.ok(size.up("sm") && !size.up("lg"));
  off();
  assert.ok(disconnected, "observer stops with its owner");
  delete globalThis.ResizeObserver;
});
