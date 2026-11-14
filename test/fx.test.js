import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/dom.ts";
installDom();
const { h, render } = await import("../src/index.ts");
const fx = await import("../src/fx/index.ts");

test("fx components render without canvas support and without style attribute strings", async () => {
  const el = document.createElement("div");
  const dispose = render(() => [h(fx.Particles, { count: 10 }), h(fx.Aurora, { colors: ["#111", "#222"] }), h(fx.Noise, {}, "x")], el);
  await new Promise((r) => setTimeout(r, 5));
  assert.ok(el.querySelector("canvas.m-fx-canvas"));
  assert.equal(el.querySelectorAll(".m-aurora-blob").length, 2);
  assert.equal(el.querySelector(".m-aurora-blob").style.getPropertyValue("--m-aurora-color"), "#111");
  assert.ok(el.querySelectorAll("*").every((n) => n.getAttribute("style") === null));
  dispose();
  await fx.confetti({ count: 3 }); // no 2D context in the test DOM: resolves and cleans up
  assert.equal(document.querySelector(".m-fx-confetti"), null);
});

test("Particles: placed only once the canvas has a size, spread over all of it; the pointer is read relative to its box", async () => {
  const proto = Object.getPrototypeOf(document.createElement("canvas"));
  const saved = { gc: proto.getContext, rect: proto.getBoundingClientRect };
  const arcs = [];
  const ctx = new Proxy({}, { get: (_, k) => (k === "arc" ? (x, y) => arcs.push([x, y]) : () => {}), set: () => true });
  let box = { left: 0, top: 0, width: 0, height: 0 };
  proto.getContext = () => ctx;
  proto.getBoundingClientRect = () => ({ ...box, right: box.left + box.width, bottom: box.top + box.height });
  let observe;
  const RO = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class { constructor(cb) { observe = cb; } observe() {} disconnect() {} };
  try {
    const el = document.createElement("div");
    const dispose = render(() => h(fx.Particles, { count: 40 }), el);
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(arcs.length, 0, "a canvas of size 0 places nothing (it would pile every particle in the corner)");
    box = { left: 200, top: 100, width: 800, height: 400 };
    observe();
    assert.equal(arcs.length, 40);
    const xs = arcs.map((a) => a[0]), ys = arcs.map((a) => a[1]);
    assert.ok(Math.max(...xs) > 400 && Math.max(...ys) > 200, "spread over the whole canvas, not the top-left corner");
    assert.ok(Math.min(...xs) >= 0 && Math.max(...xs) <= 800 && Math.max(...ys) <= 400, "inside the canvas (its own coordinates)");
    dispose();
  } finally {
    proto.getContext = saved.gc; proto.getBoundingClientRect = saved.rect; globalThis.ResizeObserver = RO;
  }
});
