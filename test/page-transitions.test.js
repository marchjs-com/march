// Page transitions on the motion engine: per-route types, back reverses, RTL mirrors slide, reduced / paused motion is
// instant, View Transitions drive the pseudo-elements through the engine, named and modal outlets take part.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/dom.ts";

installDom();
const { h, render } = await import("../src/index.ts");
const R = await import("../src/router/index.ts");
const M = await import("../src/motion/index.ts");
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

function app(routes, opts = {}) {
  globalThis.history.replaceState(null, "", "/");
  R.createRouter({ routes, ...opts });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const dispose = render(() => h("div", { class: "shell" }, h(R.Router, {}), h(R.Outlet, { name: "modal" })), host);
  return { host, done: () => { dispose(); host.remove(); R._resetRouter?.(); } };
}
const page = (k, meta) => ({ component: () => h("section", { class: "pg" }, k), ...(meta ? { meta } : {}) });

test("transitionFrames: back reverses, RTL mirrors slide, scale and fade", () => {
  const x = (f) => f[0].transform;
  assert.equal(x(M.transitionFrames("slide", "in", "forward")), "translateX(32px)");
  assert.equal(x(M.transitionFrames("slide", "in", "back")), "translateX(-32px)");
  assert.equal(x(M.transitionFrames("slide", "in", "forward", true)), "translateX(-32px)", "RTL: from the inline end (left)");
  assert.equal(M.transitionFrames("slide", "out", "forward")[1].transform, "translateX(-32px)");
  assert.equal(M.transitionFrames("slide", "out", "forward", true)[1].transform, "translateX(32px)");
  assert.notEqual(x(M.transitionFrames("scale", "in", "forward")), x(M.transitionFrames("scale", "in", "back")));
  assert.deepEqual(M.transitionFrames("fade", "in", "back"), [{ opacity: 0 }, { opacity: 1 }]);
  assert.deepEqual(M.transitionFrames("none", "in", "forward"), []);
});

test("resolveTransition: the route shown decides forward, the route left decides back; a function of the params", () => {
  const base = { type: "fade", duration: 200 };
  const m = (transition, params) => ({ meta: { transition }, params });
  assert.equal(M.resolveTransition(base, m("slide"), {}, "forward").type, "slide");
  assert.equal(M.resolveTransition(base, {}, m("scale"), "back").type, "scale");
  assert.equal(M.resolveTransition(base, {}, {}, "forward").type, "fade");
  assert.equal(M.resolveTransition(base, m(false), {}, "forward").type, "none");
  const byTab = (p) => (p.tab === "s" ? "slide" : "scale");
  assert.equal(M.resolveTransition(base, m(byTab, { tab: "s" }), {}, "forward").type, "slide");
  assert.equal(M.resolveTransition(base, m(byTab, { tab: "x" }), {}, "forward").type, "scale");
  const r = M.resolveTransition(base, m({ type: "slide", duration: 500 }), {}, "forward");
  assert.equal(r.duration, 500);
  assert.equal(M.resolveTransition(base, {}, {}, "forward").duration, 200);
});

test("back / forward from the history order (each entry stamped once)", async () => {
  const seen = [];
  R.setNavigationWrapper((apply, nav) => { seen.push([M.navDirection(nav.pop), R.path()]); apply(); });
  const a = app({ "/": page("home"), "/a": page("a"), "/b": page("b") });
  await tick();
  M.navDirection(false); // the entry the app starts on (pageTransitions() stamps it at install)
  await R.navigate("/a"); await R.navigate("/b");
  globalThis.history.back(); await tick();
  globalThis.history.back(); await tick();
  globalThis.history.forward(); await tick();
  assert.deepEqual(seen, [["forward", "/a"], ["forward", "/b"], ["back", "/a"], ["back", "/"], ["forward", "/a"]]);
  R.setNavigationWrapper(null);
  a.done();
});

test("View Transitions: the engine animates the old and new page pseudo-elements; the page is named only meanwhile", async () => {
  const calls = [];
  const root = document.documentElement;
  const origAnimate = root.animate;
  root.animate = (frames, timing) => { calls.push([timing.pseudoElement, frames]); const a = { pause() {}, play() {}, cancel() {}, finish() {}, updatePlaybackRate() {}, playbackRate: 1, currentTime: 0, playState: "paused", finished: Promise.resolve(), effect: null, addEventListener() {}, removeEventListener() {} }; return a; };
  let named = null;
  const orig = document.startViewTransition;
  document.startViewTransition = (cb) => {
    named = root.getAttribute("data-hm-vt");
    cb();
    return { updateCallbackDone: Promise.resolve(), ready: Promise.resolve(), finished: new Promise((r) => setTimeout(r, 5)) };
  };
  const stop = M.pageTransitions({ type: "fade" });
  const a = app({ "/": page("home"), "/a": page("a", { transition: "slide" }) });
  await tick();
  await R.navigate("/a"); await tick();
  assert.equal(a.host.querySelector(".pg").textContent, "a");
  assert.equal(named, "hm-page");
  assert.deepEqual(calls.map((c) => c[0]), ["::view-transition-old(hm-page)", "::view-transition-new(hm-page)"]);
  assert.equal(calls[1][1][0].transform, "translateX(32px)");
  assert.equal(root.getAttribute("data-hm-vt"), null, "cleaned up after the transition");
  assert.equal(a.host.querySelector(".pg").style.getPropertyValue("view-transition-name"), "");
  document.startViewTransition = orig; root.animate = origAnimate;
  stop(); a.done();
});

test("reduced motion and a paused engine swap instantly (no View Transition)", async () => {
  let vts = 0;
  const orig = document.startViewTransition;
  document.startViewTransition = (cb) => { vts++; cb(); return { updateCallbackDone: Promise.resolve(), finished: Promise.resolve() }; };
  const stop = M.pageTransitions({ type: "slide" });
  const a = app({ "/": page("home"), "/a": page("a"), "/b": page("b"), "/c": page("c") });
  await tick();
  M.setReducedMotion(true);
  await R.navigate("/a");
  M.setReducedMotion(null);
  M.motion.pauseAll();
  await R.navigate("/b");
  M.motion.resumeAll();
  assert.equal(vts, 0);
  await R.navigate("/c");
  assert.equal(vts, 1);
  assert.equal(a.host.querySelector(".pg").textContent, "c");
  document.startViewTransition = orig;
  stop(); a.done();
});

test("fallback without View Transitions: the old page leaves, the new one enters, a shared element moves", async () => {
  const orig = document.startViewTransition;
  document.startViewTransition = undefined;
  const stop = M.pageTransitions({ type: "slide", duration: 40 });
  const a = app({
    "/": { component: () => h("section", { class: "pg" }, h("img", { "data-hm-shared": "p1", alt: "" })) },
    "/a": { component: () => h("section", { class: "pg" }, "a", h("img", { "data-hm-shared": "p1", alt: "" })) },
  });
  await tick();
  await R.navigate("/a"); await tick(60);
  assert.equal(a.host.querySelectorAll(".pg").length, 1);
  assert.match(a.host.querySelector(".pg").textContent, /a/);
  document.startViewTransition = orig;
  stop(); a.done();
});

test("modal outlet: opening is left to the dialog, a swap inside it animates through the outlet wrapper", async () => {
  const swaps = [];
  const O = await import("../src/router/outlets.ts");
  O.setOutletWrapper((name, apply, o) => { swaps.push([name, M.navDirection(true), o.from?.path ?? null, o.to?.path ?? null]); apply(); });
  const a = app({ "/": page("home"), "/p/:id": { component: (p) => h("div", { class: "photo" }, `photo ${p.params.id}`), meta: { transition: "scale" } } });
  await tick();
  await R.navigate("/p/1", { modal: true }); await tick();
  await R.navigate("/p/2", { modal: true }); await tick();
  assert.equal(a.host.querySelector("[data-outlet-page=modal] .photo")?.textContent, "photo 2");
  globalThis.history.back(); await tick();
  assert.deepEqual(swaps, [["modal", "forward", null, "/p/1"], ["modal", "forward", "/p/1", "/p/2"], ["modal", "back", "/p/2", "/p/1"]]);
  O.setOutletWrapper(null);
  a.done();
});

test("a View Transition that never runs its update (page not rendering) still swaps the page", async () => {
  const orig = document.startViewTransition;
  let skipped = 0;
  document.startViewTransition = () => ({ updateCallbackDone: new Promise(() => {}), ready: new Promise(() => {}), finished: new Promise(() => {}), skipTransition() { skipped++; } });
  const stop = M.pageTransitions({ type: "fade", duration: 50 });
  const a = app({ "/": page("home"), "/a": page("a") });
  await tick();
  await R.navigate("/a");
  assert.equal(a.host.querySelector(".pg").textContent, "a");
  assert.equal(skipped, 1);
  document.startViewTransition = orig;
  stop(); a.done();
});
