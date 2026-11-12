import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const G = await import("./crop.ts");
const { ImageCropper } = await import("./index.ts");

test("crop geometry: cover scale at any angle, pan limits, fitted frame", () => {
  assert.equal(G.coverScale(800, 600, 400, 300, 0), 0.5);
  assert.equal(G.coverScale(800, 600, 400, 400, 0), 2 / 3, "a square frame needs the shorter side");
  const r = G.coverScale(800, 600, 400, 300, 90);
  assert.ok(Math.abs(r - 400 / 600) < 1e-9, "turned 90°: width against height");
  assert.ok(G.coverScale(800, 600, 400, 300, 30) > 0.5, "a tilted image must grow to keep the corners covered");
  const st = { ...G.DEFAULT_CROP, zoom: 2, x: 5, y: -5 };
  const [x, y] = G.clampPan(st, 800, 600, 400, 300);
  assert.ok(Math.abs(x - 0.5) < 1e-9 && Math.abs(y + 0.5) < 1e-9, "at 2× the image can move half a frame each way");
  assert.deepEqual(G.clampPan({ ...G.DEFAULT_CROP, x: 1 }, 800, 600, 400, 300), [0, 0], "at 1× it cannot move");
  assert.deepEqual(G.frameSize({ ...G.DEFAULT_CROP, aspect: 1, w: 0.8, h: 0.8 }, 400, 300), [240, 240]);
});

test("ImageCropper: labelled area, aspect choices, rotate / mirror / reset buttons, keys change the state", () => {
  const v = signal({ ...G.DEFAULT_CROP });
  const el = document.createElement("div");
  document.body.appendChild(el);
  const dispose = render(() => h(ImageCropper, { src: "/x.png", alt: "Hills", "bind:value": v, preview: false }), el);
  const area = el.querySelector(".hm-crop-view");
  assert.equal(area.getAttribute("aria-label"), "Crop area: Hills");
  assert.deepEqual(el.querySelectorAll(".hm-crop-aspects [role=radio]").map((b) => b.textContent), ["Free", "1:1", "4:3", "16:9", "3:4", "9:16"]);
  const btn = (name) => el.querySelectorAll("button").find((b) => b.getAttribute("aria-label") === name);
  btn("Rotate right").click();
  assert.equal(v().rotate, 90);
  btn("Mirror").click();
  assert.equal(v().flip, true);
  assert.equal(btn("Mirror").getAttribute("aria-pressed"), "true");
  area.dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "+", bubbles: true }));
  assert.ok(Math.abs(v().zoom - 1.1) < 1e-9);
  area.dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "]", bubbles: true }));
  assert.equal(v().rotate, 91);
  btn("Reset").click();
  assert.deepEqual([v().zoom, v().rotate, v().flip], [1, 0, false]);
  dispose();
});
