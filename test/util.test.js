// core/util: the shared helpers that components, charts, tables, forms and motion use instead of their own copies.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { installDom } from "../src/testing/dom.ts";

installDom();
const { clamp, lerp, setStyle, listen, onVisible, uid } = await import("../src/core/util.ts");
const { createRoot } = await import("../src/core/reactive.ts");

test("clamp keeps a value in range (lo wins when the bounds cross); lerp blends", () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(11, 0, 10), 10);
  assert.equal(clamp(5, 3, 1), 3, "same as Math.max(lo, Math.min(hi, v))");
  assert.equal(lerp(10, 20, 0.25), 12.5);
});

test("setStyle sets and removes properties, custom properties too", () => {
  const el = document.createElement("div");
  setStyle(el, { "--x": 4, color: "red" });
  assert.equal(el.style.getPropertyValue("--x"), "4");
  assert.equal(el.style.getPropertyValue("color"), "red");
  setStyle(el, { "--x": null });
  assert.equal(el.style.getPropertyValue("--x"), "");
  setStyle(null, { color: "blue" }); // no element: nothing happens
});

test("listen adds several listeners and removes them with one off, or with the owner", () => {
  const el = document.createElement("div");
  const seen = [];
  const off = listen(el, { click: () => seen.push("click"), keydown: () => seen.push("key") });
  el.dispatchEvent(new Event("click")); el.dispatchEvent(new Event("keydown"));
  off();
  el.dispatchEvent(new Event("click"));
  assert.deepEqual(seen, ["click", "key"]);
  createRoot((dispose) => { listen(el, { click: () => seen.push("owned") }); dispose(); });
  el.dispatchEvent(new Event("click"));
  assert.deepEqual(seen, ["click", "key"], "removed with the owner");
});

test("onVisible runs once on the first intersection; without IntersectionObserver at once", () => {
  const prev = globalThis.IntersectionObserver;
  let cb; let disconnected = 0;
  globalThis.IntersectionObserver = class { constructor(fn) { cb = fn; } observe() {} disconnect() { disconnected++; } };
  let runs = 0;
  onVisible(document.createElement("div"), () => runs++);
  cb([{ isIntersecting: false }]);
  assert.equal(runs, 0);
  cb([{ isIntersecting: true }]);
  assert.equal(runs, 1);
  assert.equal(disconnected, 1);
  delete globalThis.IntersectionObserver;
  onVisible(document.createElement("div"), () => runs++);
  assert.equal(runs, 2);
  globalThis.IntersectionObserver = prev;
});

test("uid gives distinct ids with a prefix", () => {
  const a = uid("x"), b = uid("x");
  assert.notEqual(a, b);
  assert.match(a, /^x-/);
});

// the copies the duplication audit found stay gone: no hand-written clamp, JSON storage or id counter outside core/util
test("no hand-written copies of the shared helpers", () => {
  const SRC = fileURLToPath(new URL("../src/", import.meta.url));
  const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : /\.ts$/.test(n) && !/test/.test(n) ? [p] : []; });
  const bad = [];
  for (const f of walk(SRC)) {
    if (/core[\\/]util\.ts$/.test(f)) continue;
    const s = readFileSync(f, "utf8");
    if (/Math\.max\([^(),]+, Math\.min\([^()]*\)\)/.test(s)) bad.push(`${f}: Math.max(lo, Math.min(hi, v)) → clamp()`);
    if (/JSON\.parse\(globalThis\.localStorage/.test(s) || /localStorage\?*\.setItem\([^)]*JSON\.stringify/.test(s)) bad.push(`${f}: JSON storage → load() / save()`);
    if (/^let uid = 0;/m.test(s)) bad.push(`${f}: id counter → uid()`);
  }
  assert.deepEqual(bad, []);
});
