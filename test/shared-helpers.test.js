// The shared helpers components use instead of their own copies: parts (ownPart / ownIcon / hasPart), formatting,
// key helpers, observers and scroll helpers, motion parts, the drag ghost, the brand color list.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../src/testing/dom.ts";

const { document } = installDom();
const { createRoot } = await import("../src/core/reactive.ts");
const { setLocale } = await import("../src/core/i18n.ts");
const { ownPart, ownIcon, hasPart } = await import("../src/ui/parts.ts");
const rows = await import("../src/forms/rows.ts");
const { formatDuration, formatSeconds, formatCount, errorText, hashString, snap } = await import("../src/ui/format.ts");
const { isMod, labelWithKey, undoKeys } = await import("../src/ui/keys.ts");
const { owned, observeSize, whenVisible, stickToBottom, scrollIntoArea } = await import("../src/ui/observe.ts");
const { observeWidth } = await import("../src/ui/fit.ts");
const { still, motionPreset, slidingIndicator, swapFrames, swapTransition } = await import("../src/motion/engine/parts.ts");
const { setReducedOverride } = await import("../src/motion/engine/prefs.ts");
const { dragGhost } = await import("../src/behaviors/drag/ghost.ts");
const { BRAND_COLORS, BRAND_COLORS_ALL, colorList, COLOR_TOKENS } = await import("../src/theme/colors.ts");
const { check } = await import("../src/icons/glyphs/check.ts");
const { x: xIcon } = await import("../src/icons/glyphs/x.ts");

const box = (el, r) => { el.getBoundingClientRect = () => ({ x: r.left, y: r.top, left: r.left, top: r.top, width: r.width, height: r.height, right: r.left + r.width, bottom: r.top + r.height }); return el; };
const div = (cls = "") => { const el = document.createElement("div"); el.className = cls; return el; };

test("ownPart: default, nothing, function, text, node (a copy once it is placed); forms/rows gives the same function", () => {
  const def = () => "default";
  assert.equal(ownPart(undefined, def), "default");
  assert.equal(ownPart(true, def), "default");
  assert.equal(ownPart(false, def), null);
  assert.equal(ownPart(null, def), null);
  assert.equal(ownPart(() => "mine", def), "mine");
  assert.equal(ownPart("–", def), "–");
  const node = document.createElement("b");
  assert.equal(ownPart(node, def), node, "a free node is used as it is (keeps its listeners)");
  div().appendChild(node);
  const copy = ownPart(node, def);
  assert.notEqual(copy, node, "a placed node is copied: parts repeat per row");
  assert.equal(copy.tagName, "B");
  assert.equal(rows.ownPart, ownPart);
});

test("ownIcon: default glyph, nothing, own IconDef / text / node / function, bare mode", () => {
  assert.equal(ownIcon(undefined, check).tagName.toLowerCase(), "svg");
  assert.equal(ownIcon(true, check).tagName.toLowerCase(), "svg");
  assert.equal(ownIcon(false, check), null);
  assert.equal(ownIcon(null, check), null);
  const own = ownIcon(xIcon, check, "hm-copy-icon");
  assert.equal(own.tagName, "SPAN");
  assert.equal(own.className, "hm-copy-icon");
  assert.equal(own.getAttribute("aria-hidden"), "true");
  assert.equal(ownIcon("★", check).textContent, "★");
  assert.equal(ownIcon("★", check).className, "hm-icon");
  const node = document.createElement("i");
  assert.equal(ownIcon(node, check), node);
  assert.equal(ownIcon(() => "★", check, "k").className, "k");
  assert.equal(ownIcon(() => undefined, check), null, "a function that gives nothing shows nothing");
  assert.equal(ownIcon(xIcon, check, null).tagName.toLowerCase(), "svg", "cls null: an own IconDef is drawn bare like the default");
  assert.equal(ownIcon("★", check, null).tagName, "SPAN");
});

test("hasPart: unset / true show everything, false nothing, a list only what it names; accessors are read", () => {
  assert.equal(hasPart(undefined, "zoom"), true);
  assert.equal(hasPart(null, "zoom"), true);
  assert.equal(hasPart(true, "zoom"), true);
  assert.equal(hasPart(false, "zoom"), false);
  assert.equal(hasPart(["zoom", "fit"], "fit"), true);
  assert.equal(hasPart(["zoom", "fit"], "layout"), false);
  assert.equal(hasPart(() => ["zoom"], "zoom"), true);
  assert.equal(hasPart(() => false, "zoom"), false);
  assert.equal(hasPart(false), false);
  assert.equal(hasPart(undefined), true);
  assert.equal(hasPart([]), false);
  assert.equal(hasPart(["a"]), true);
});

test("brand colors: one list, used by colorList('brand'); every name is a color token", () => {
  assert.deepEqual([...BRAND_COLORS], ["brand-orange", "brand-blue", "brand-green", "brand-purple"]);
  assert.deepEqual([...BRAND_COLORS_ALL], [...BRAND_COLORS, "brand-pink", "brand-gold"]);
  assert.deepEqual(colorList("brand"), [...BRAND_COLORS]);
  for (const c of BRAND_COLORS_ALL) assert.ok(COLOR_TOKENS.includes(c), c);
});

test("formatDuration: m:ss, padded minutes, fraction digits, never negative; formatSeconds", () => {
  assert.equal(formatDuration(0), "0:00");
  assert.equal(formatDuration(83_000), "1:23");
  assert.equal(formatDuration(83_999), "1:23", "whole seconds are floored");
  assert.equal(formatDuration(83_000, { pad: true }), "01:23");
  assert.equal(formatDuration(3_600_000), "60:00");
  assert.equal(formatDuration(1230, { pad: true, decimals: 2 }), "00:01.23");
  assert.equal(formatDuration(59_999, { pad: true, decimals: 2 }), "00:59.99", "never rounds up into the next minute");
  assert.equal(formatDuration(-5, { pad: true, decimals: 2 }), "00:00.00");
  assert.equal(formatSeconds(1234), "1.23 s");
  assert.equal(formatSeconds(12_340), "12.3 s");
});

test("formatCount: compact / full by the active locale, Intl options with a locale", () => {
  setLocale("en");
  assert.equal(formatCount(5), "5");
  assert.equal(formatCount(999), "999");
  assert.equal(formatCount(1234), "1.2K");
  assert.equal(formatCount(1234, "full"), "1,234");
  assert.equal(formatCount(1234.5, { decimals: 1 }, "en"), "1,234.5");
  assert.equal(formatCount(1234.5, {}, "en"), "1,235");
  assert.equal(formatCount(0.5, { format: { style: "percent" } }, "en"), "50%");
  assert.equal(formatCount(1234, { decimals: 0 }), "1,234", "no locale given: the active one");
});

test("errorText, hashString, snap", () => {
  assert.equal(errorText(new Error("boom")), "boom");
  assert.equal(errorText("plain"), "plain");
  assert.equal(errorText(null), "null");
  assert.equal(errorText(undefined), "undefined");
  assert.equal(errorText({ message: "from an object" }), "from an object");
  assert.equal(hashString("Ada"), hashString("Ada"));
  assert.notEqual(hashString("Ada"), hashString("Bob"));
  assert.equal(hashString(""), 0);
  assert.equal(hashString(null), 0);
  assert.equal(hashString("ab"), (97 * 31 + 98) >>> 0);
  assert.ok(Number.isInteger(hashString("a long text ".repeat(50))) && hashString("a long text ".repeat(50)) >= 0);
  assert.equal(snap(23, 16), 16);
  assert.equal(snap(25, 16), 32);
  assert.equal(snap(23, 0), 23);
  assert.equal(snap(-9, 16), -16);
});

test("isMod, labelWithKey, undoKeys", () => {
  assert.equal(isMod({ ctrlKey: true, metaKey: false }), true);
  assert.equal(isMod({ ctrlKey: false, metaKey: true }), true);
  assert.equal(isMod({ ctrlKey: false, metaKey: false }), false);
  assert.equal(labelWithKey("Save"), "Save");
  assert.equal(labelWithKey("Save", null), "Save");
  assert.match(labelWithKey("Save", "mod+s"), /^Save \((Ctrl\+S|⌘S)\)$/);
  const log = [];
  const stack = { undo: () => log.push("undo"), redo: () => log.push("redo") };
  const key = (k, init = {}) => { const e = new Event("keydown", { cancelable: true }); Object.assign(e, { key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...init }); return e; };
  let e = key("z", { ctrlKey: true });
  assert.equal(undoKeys(e, stack), true);
  assert.equal(e.defaultPrevented, true);
  assert.equal(undoKeys(key("Z", { metaKey: true, shiftKey: true }), stack), true);
  assert.equal(undoKeys(key("y", { ctrlKey: true }), stack), true);
  assert.deepEqual(log, ["undo", "redo", "redo"]);
  e = key("z");
  assert.equal(undoKeys(e, stack), false, "no modifier");
  assert.equal(e.defaultPrevented, false);
  assert.equal(undoKeys(key("z", { ctrlKey: true, altKey: true }), stack), false);
  assert.equal(undoKeys(key("b", { ctrlKey: true }), stack), false);
  assert.equal(undoKeys(key("y", { ctrlKey: true, shiftKey: true }), stack), false);
  assert.equal(undoKeys(key("z", { ctrlKey: true }), null), true, "no stack: the key is still taken");
  assert.equal(log.length, 3);
});

test("owned: runs with the owner; without one nothing is registered", () => {
  let n = 0;
  const dispose = createRoot((d) => { owned(() => n++); return d; });
  assert.equal(n, 0);
  dispose();
  assert.equal(n, 1);
  const stop = owned(() => n++);
  stop();
  assert.equal(n, 2);
});

test("observeSize: reports the content box, stops with the owner; without ResizeObserver it reports once", () => {
  const el = div();
  Object.defineProperty(el, "clientWidth", { value: 120, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: 40, configurable: true });
  const seen = [];
  assert.equal(typeof globalThis.ResizeObserver, "undefined");
  observeSize(el, (s, e) => seen.push([s.width, s.height, e === el]));
  assert.deepEqual(seen, [[120, 40, true]]);
  const widths = [];
  observeWidth(el, (w) => widths.push(w));
  assert.deepEqual(widths, [120], "observeWidth is observeSize");

  const made = [];
  globalThis.ResizeObserver = class { constructor(cb) { this.cb = cb; this.on = []; made.push(this); } observe(x) { this.on.push(x); } disconnect() { this.on = []; } };
  try {
    seen.length = 0;
    const dispose = createRoot((d) => { observeSize(el, (s) => seen.push([s.width, s.height])); return d; });
    assert.deepEqual(made[0].on, [el]);
    made[0].cb([{ contentRect: { width: 300, height: 80 } }]);
    assert.deepEqual(seen, [[300, 80]]);
    dispose();
    assert.deepEqual(made[0].on, [], "disconnected with the owner");
  } finally { delete globalThis.ResizeObserver; }
});

test("whenVisible: true / false as it enters and leaves, false when watching stops; visible without IntersectionObserver", () => {
  const el = div(), log = [];
  const stopPlain = whenVisible(el, (v) => log.push(v));
  assert.deepEqual(log, [true]);
  stopPlain(); stopPlain();
  assert.deepEqual(log, [true, false], "stopping twice reports once");

  const made = [];
  const old = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = class { constructor(cb, opts) { this.cb = cb; this.opts = opts; this.live = true; made.push(this); } observe() {} disconnect() { this.live = false; } };
  try {
    log.length = 0;
    const dispose = createRoot((d) => { whenVisible(el, (v) => log.push(v), { threshold: 0.4 }); return d; });
    assert.deepEqual(log, []);
    assert.equal(made[0].opts.threshold, 0.4);
    made[0].cb([{ isIntersecting: true }]);
    made[0].cb([{ isIntersecting: true }]);
    made[0].cb([{ isIntersecting: false }]);
    made[0].cb([{ isIntersecting: true }]);
    assert.deepEqual(log, [true, false, true], "only changes are reported");
    dispose();
    assert.deepEqual(log, [true, false, true, false]);
    assert.equal(made[0].live, false);
  } finally { if (old) globalThis.IntersectionObserver = old; else delete globalThis.IntersectionObserver; }
});

test("stickToBottom: pinned until the reader scrolls up; toBottom pins again; follows growing content", () => {
  const sc = div();
  let height = 500;
  Object.defineProperty(sc, "scrollHeight", { get: () => height, configurable: true });
  Object.defineProperty(sc, "clientHeight", { value: 100, configurable: true });
  sc.scrollTop = 0;
  const changes = [];
  const stick = stickToBottom(sc, { threshold: 80, onChange: (p) => changes.push(p) });
  assert.equal(stick.pinned(), true);
  stick.toBottom();
  assert.equal(sc.scrollTop, 500);
  sc.scrollTop = 200; sc.dispatchEvent(new Event("scroll"));
  assert.equal(stick.pinned(), false);
  sc.scrollTop = 330; sc.dispatchEvent(new Event("scroll"));
  assert.equal(stick.pinned(), true, "within the threshold");
  assert.deepEqual(changes, [false, true]);
  sc.scrollTop = 0; sc.dispatchEvent(new Event("scroll"));
  let smooth = null;
  sc.scrollTo = (o) => { smooth = o; };
  stick.toBottom(true);
  assert.deepEqual(smooth, { top: 500, behavior: "smooth" });
  assert.equal(stick.pinned(), true);
  stick.stop();
  sc.scrollTop = 0; sc.dispatchEvent(new Event("scroll"));
  assert.equal(stick.pinned(), true, "stopped: scrolling no longer changes it");

  const made = [];
  globalThis.ResizeObserver = class { constructor(cb) { this.cb = cb; made.push(this); } observe() {} disconnect() { this.off = true; } };
  try {
    const out = div(), sc2 = div();
    Object.defineProperty(sc2, "scrollHeight", { get: () => height, configurable: true });
    Object.defineProperty(sc2, "clientHeight", { value: 100, configurable: true });
    const s2 = stickToBottom(sc2, { follow: out });
    height = 900; made[0].cb([{ contentRect: { width: 0, height: 900 } }]);
    assert.equal(sc2.scrollTop, 900, "pinned: growth keeps the end in view");
    sc2.scrollTop = 100; sc2.dispatchEvent(new Event("scroll"));
    height = 1200; made[0].cb([{ contentRect: { width: 0, height: 1200 } }]);
    assert.equal(sc2.scrollTop, 100, "scrolled up: stays where the reader is");
    s2.stop();
    assert.equal(made[0].off, true);
  } finally { delete globalThis.ResizeObserver; }
});

test("scrollIntoArea: scrolls only the area, only when the row is outside it", () => {
  const sc = box(div(), { left: 0, top: 100, width: 200, height: 300 });
  sc.scrollTop = 50;
  let asked = null;
  sc.scrollTo = (o) => { asked = o; };
  assert.equal(scrollIntoArea(box(div(), { left: 0, top: 150, width: 200, height: 30 }), sc), false, "already in view");
  assert.equal(asked, null);
  assert.equal(scrollIntoArea(box(div(), { left: 0, top: 60, width: 200, height: 30 }), sc), true);
  assert.deepEqual(asked, { top: 10, behavior: "auto" }, "above: its top comes to the top");
  assert.equal(scrollIntoArea(box(div(), { left: 0, top: 390, width: 200, height: 30 }), sc, { smooth: true }), true);
  assert.deepEqual(asked, { top: 70, behavior: "smooth" }, "below: its bottom comes to the bottom");
  assert.equal(scrollIntoArea(box(div(), { left: 0, top: 390, width: 200, height: 30 }), sc, { margin: 10 }), true);
  assert.deepEqual(asked, { top: 80, behavior: "auto" });
  assert.equal(scrollIntoArea(null, sc), false);
  assert.equal(scrollIntoArea(div(), null), false);
  assert.equal(scrollIntoArea(div(), box(div(), { left: 0, top: 0, width: 0, height: 0 })), false, "a hidden area");
});

test("still: the motion option or the reduced-motion preference", () => {
  setReducedOverride(false);
  assert.equal(still(), false);
  assert.equal(still(true), false);
  assert.equal(still(false), true);
  assert.equal(still("none"), true);
  assert.equal(still(() => false), true);
  assert.equal(still("pop"), false);
  setReducedOverride(true);
  assert.equal(still(true), true);
  setReducedOverride(false);
});

test("motionPreset: [hidden, shown] keyframes; overrides; an unknown name is pop", () => {
  assert.deepEqual(motionPreset("pop"), [{ opacity: 0, transform: "scale(0.85)" }, { opacity: 1, transform: "none" }]);
  assert.deepEqual(motionPreset("fade")[0], { opacity: 0, transform: "none" });
  assert.deepEqual(motionPreset("slide")[0], { opacity: 0, transform: "translateY(12px)" });
  assert.deepEqual(motionPreset("rise")[0], { opacity: 0, transform: "translateY(8px)" });
  assert.deepEqual(motionPreset("pop", { y: 12 })[0], { opacity: 0, transform: "translateY(12px) scale(0.85)" });
  assert.deepEqual(motionPreset("slide", { x: -24, y: 0 })[0], { opacity: 0, transform: "translateX(-24px)" });
  assert.deepEqual(motionPreset("whatever"), motionPreset("pop"));
});

test("slidingIndicator: final place and size are set at once; hides on null; axis, size variable, RTL", () => {
  setReducedOverride(true); // placement only: nothing plays
  const list = box(div(), { left: 100, top: 20, width: 400, height: 40 });
  const a = box(div(), { left: 110, top: 24, width: 60, height: 32 }), b = box(div(), { left: 200, top: 24, width: 90, height: 32 });
  const pill = div();
  const ind = slidingIndicator(pill, list);
  ind.moveTo(a);
  assert.equal(pill.style.getPropertyValue("transform"), "translateX(10px)");
  assert.equal(pill.style.getPropertyValue("width"), "60px");
  assert.equal(pill.style.getPropertyValue("opacity"), "1");
  assert.ok(pill.classList.contains("is-on"));
  ind.moveTo(b);
  assert.equal(pill.style.getPropertyValue("transform"), "translateX(100px)");
  assert.equal(pill.style.getPropertyValue("width"), "90px");
  ind.moveTo(null);
  assert.equal(pill.style.getPropertyValue("opacity"), "0");
  assert.ok(!pill.classList.contains("is-on"));

  const bar = div();
  const vert = slidingIndicator(bar, list, { axis: () => "y", sizeVar: "--hm-ab-size", onClass: "is-shown" });
  vert.moveTo(a);
  assert.equal(bar.style.getPropertyValue("transform"), "translateY(4px)");
  assert.equal(bar.style.getPropertyValue("--hm-ab-size"), "32px");
  assert.equal(bar.style.getPropertyValue("height"), "");
  assert.ok(bar.classList.contains("is-shown"));

  const rtl = box(div(), { left: 100, top: 20, width: 400, height: 40 });
  rtl.setAttribute("dir", "rtl");
  const p2 = div();
  slidingIndicator(p2, rtl).moveTo(a);
  assert.equal(p2.style.getPropertyValue("transform"), "translateX(-330px)", "RTL: measured from the right edge");
  setReducedOverride(false);
});

test("slidingIndicator: glides from the old place (stretching from the old size) when motion is on", async () => {
  setReducedOverride(false);
  const list = box(div(), { left: 0, top: 0, width: 400, height: 40 });
  const a = box(div(), { left: 10, top: 0, width: 60, height: 32 }), b = box(div(), { left: 200, top: 0, width: 120, height: 32 });
  const pill = div();
  document.body.append(list, pill);
  const ind = slidingIndicator(pill, list, { duration: 1 });
  ind.moveTo(a);
  await new Promise((r) => setTimeout(r, 40));
  ind.moveTo(b);
  // the test DOM has no WAAPI: the engine writes the frames to the style, so the first frame is visible here
  assert.equal(pill.style.getPropertyValue("transform"), "translateX(10px) scaleX(0.5)", "starts at the old place, at the old size");
  assert.equal(pill.style.getPropertyValue("width"), "120px", "the final size is set at once");
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(pill.style.getPropertyValue("transform"), "translateX(200px) scaleX(1)", "ends at the new place");
  ind.reset();
  ind.moveTo(a, true);
  assert.equal(pill.style.getPropertyValue("transform"), "translateX(10px)", "instant: placed, nothing plays");
});

test("swapFrames: direction and distance; swapTransition: none / reduced / own function / own frames", async () => {
  assert.deepEqual(swapFrames("fade"), { enter: { opacity: [0, 1] }, leave: { opacity: [1, 0] } });
  assert.deepEqual(swapFrames("slide", 1, "8%").enter.transform, ["translate3d(8%, 0, 0)", "translate3d(0, 0, 0)"]);
  assert.deepEqual(swapFrames("slide", -1, "8%").leave.transform, ["translate3d(0, 0, 0)", "translate3d(8%, 0, 0)"]);
  assert.deepEqual(swapFrames("slide").enter.transform[0], "translate3d(80px, 0, 0)");
  assert.deepEqual(swapFrames("rise", 1).enter.transform[0], "translate3d(0, 24px, 0) scale(.97)");
  assert.deepEqual(swapFrames("rise", 1).leave.transform[1], "translate3d(0, -16px, 0) scale(.98)");
  assert.deepEqual(swapFrames("zoom").leave.transform, ["scale(1)", "scale(1.06)"]);
  assert.match(swapFrames("turn", -1).enter.transform[0], /rotateY\(22deg\) translateX\(-70px\)/);

  const inEl = div(), outEl = div();
  document.body.append(inEl, outEl);
  setReducedOverride(false);
  await swapTransition(inEl, outEl, "none");
  await swapTransition(inEl, outEl, false);
  await swapTransition(inEl, outEl, "slide", { motion: false });
  assert.equal(outEl.className, "", "nothing played: no leaving class");
  const calls = [];
  await swapTransition(inEl, outEl, (i, o, d) => calls.push([i === inEl, o === outEl, d]), { dir: -1 });
  assert.deepEqual(calls, [[true, true, -1]]);
  setReducedOverride(true);
  await swapTransition(inEl, outEl, "slide");
  await swapTransition(inEl, outEl, (i) => calls.push(i));
  assert.equal(calls.length, 1, "reduced motion: not even the own function");
  setReducedOverride(false);

  const done = swapTransition(inEl, outEl, "fade", { duration: 1, leaveDuration: 1, leavingClass: "is-out" });
  assert.equal(outEl.className, "is-out", "the old view is marked while it leaves");
  await done;
  assert.equal(outEl.className, "");
  await swapTransition(inEl, null, { enter: { opacity: [0, 1] }, leave: { opacity: [1, 0] } }, { duration: 1 });
  await swapTransition(null, outEl, "zoom", { leaveDuration: 1, leavingClass: false });
  assert.equal(outEl.className, "");
});

test("dragGhost: lives in the drag layer, follows the pointer, is removed by close / leave / the owner", async () => {
  setReducedOverride(true);
  const node = div("ghost"); node.id = "copy";
  const g = dragGhost(node);
  const layer = node.closest("[data-layer]");
  assert.equal(layer?.getAttribute("data-layer"), "drag");
  assert.equal(node.getAttribute("aria-hidden"), "true");
  assert.equal(node.getAttribute("id"), null, "a copied node never repeats an id");
  g.move(100, 50);
  assert.equal(node.style.getPropertyValue("left"), "112px");
  assert.equal(node.style.getPropertyValue("top"), "60px");
  g.close(); g.close();
  assert.equal(node.closest("[data-layer]")?.isConnected ?? false, false);

  const n2 = div();
  const g2 = dragGhost(n2, { offset: { x: -5, y: -7 } });
  g2.move(100, 50);
  assert.equal(n2.style.getPropertyValue("left"), "95px");
  assert.equal(n2.style.getPropertyValue("top"), "43px");
  await g2.leave([{ opacity: 1 }, { opacity: 0 }]);
  assert.equal(n2.closest("[data-layer]")?.isConnected ?? false, false);

  const n3 = div();
  const dispose = createRoot((d) => { dragGhost(n3); return d; });
  assert.equal(n3.closest("[data-layer]")?.isConnected, true);
  dispose();
  assert.equal(n3.closest("[data-layer]")?.isConnected ?? false, false, "a component removed mid-drag takes its ghost along");

  setReducedOverride(false);
  const n4 = div();
  const g4 = dragGhost(n4, { timing: { duration: 1 } });
  await g4.leave([{ opacity: 1 }, { opacity: 0 }], { duration: 1 });
  assert.equal(n4.closest("[data-layer]")?.isConnected ?? false, false);
});
