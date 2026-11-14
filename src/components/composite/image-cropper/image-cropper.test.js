import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, reactive } = await import("../../../index.ts");
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

test("crop geometry: at every angle and aspect the image covers the frame, and the pan limit is exactly the edge", () => {
  const iw = 1600, ih = 1067; // a landscape photo, as in the showcase
  const view = [640, 480];
  for (const aspect of [null, 1, 4 / 3, 16 / 9, 9 / 16, 3 / 4]) {
    for (const rotate of [0, 90, 17, -17, 45, 180, 270, 33.3]) {
      for (const zoom of [1, 1.7, 4]) {
        const st = { ...G.DEFAULT_CROP, aspect, rotate, zoom };
        const [fw, fh] = G.frameSize(st, view[0], view[1]);
        const S = G.coverScale(iw, ih, fw, fh, rotate) * zoom, a = (rotate * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
        // the frame corners in image pixels, for a pan pushed far to each side
        for (const [dx, dy] of [[-9, 0], [9, 0], [0, -9], [0, 9], [-9, -9], [9, 9], [0, 0]]) {
          const [x, y] = G.clampPan({ ...st, x: dx, y: dy }, iw, ih, fw, fh);
          let reach = 0;
          for (const [kx, ky] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            const px = (kx * fw) / 2 - x * fw, py = (ky * fh) / 2 - y * fh; // corner relative to the image center (screen px)
            const u = (px * c + py * s) / S, v = (-px * s + py * c) / S;     // back into image pixels
            assert.ok(Math.abs(u) <= iw / 2 + 1e-6 && Math.abs(v) <= ih / 2 + 1e-6, `corner outside the image: aspect ${aspect} ${rotate}° zoom ${zoom} pan ${dx},${dy}`);
            reach = Math.max(reach, Math.abs(u) / (iw / 2), Math.abs(v) / (ih / 2));
          }
          // pushed to a side, the image edge meets the frame edge: no more, no less
          if (dx || dy) assert.ok(reach > 1 - 1e-6, `pan stops short of the edge: aspect ${aspect} ${rotate}° zoom ${zoom} pan ${dx},${dy} (${reach})`);
        }
      }
    }
  }
});

test("ImageCropper: grid, hint, buttons, sliders and caption off or chosen; own texts", () => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const dispose = render(() => [
    h(ImageCropper, { src: "data:,", class: "mine", grid: false, hint: false, tools: ["mirror"], sliders: ["zoom"], size: false,
      labels: { cropper: "Photo", area: "Frame", role: "frame tool", hint: "Drag it", free: "Any", mirror: "Flip", zoom: "Size", result: "Outcome" } }),
    h(ImageCropper, { src: "data:,", alt: "Hills", tools: false, sliders: false }),
    h(ImageCropper, { src: "data:," }),
  ], el);
  const [a, b, c] = el.querySelectorAll(".hm-crop");
  assert.ok(a.classList.contains("mine"));
  assert.equal(a.getAttribute("aria-label"), "Photo");
  assert.equal(a.querySelector(".hm-crop-view").getAttribute("aria-label"), "Frame");
  assert.equal(a.querySelector(".hm-crop-view").getAttribute("aria-roledescription"), "frame tool");
  assert.equal(a.querySelector(".hm-crop-grid"), null);
  const keys = a.querySelector(".hm-crop-keys");
  assert.ok(keys.classList.contains("hm-sr-only"), "a hidden hint still describes the area");
  assert.equal(keys.textContent, "Drag it");
  assert.deepEqual([...a.querySelectorAll(".hm-crop-row button")].map((x) => x.getAttribute("aria-label")), ["Flip"]);
  assert.equal(a.querySelectorAll(".hm-crop-slider").length, 1);
  assert.match(a.querySelector(".hm-crop-zoom").textContent, /Size/);
  assert.match(a.querySelector(".hm-crop-aspects").textContent, /Any/);
  assert.equal(a.querySelector(".hm-crop-canvas").getAttribute("aria-label"), "Outcome");
  assert.equal(a.querySelector("figcaption"), null);
  assert.equal(b.querySelector(".hm-crop-row"), null);
  assert.equal(b.querySelector(".hm-crop-slider"), null);
  assert.equal(b.querySelector(".hm-crop-view").getAttribute("aria-label"), "Crop area: Hills");
  assert.ok(b.querySelector(".hm-crop-grid") && b.querySelector("figcaption"));
  assert.equal(c.querySelectorAll(".hm-crop-row button").length, 4);
  assert.equal(c.querySelectorAll(".hm-crop-slider").length, 2);
  assert.ok(!c.querySelector(".hm-crop-keys").classList.contains("hm-sr-only"));
  dispose();
});

test("ImageCropper: maxZoom is live (the zoom slider follows it, a lower limit pulls the zoom back)", async () => {
  const max = signal(4), v = signal({ ...G.DEFAULT_CROP, zoom: 3 });
  const el = document.createElement("div");
  document.body.appendChild(el);
  const dispose = render(() => h(ImageCropper, { src: "/x.png", "bind:value": v, preview: false, maxZoom: reactive(() => max()) }), el);
  const zoom = el.querySelector(".hm-crop-zoom input[type=range]");
  assert.equal(zoom.getAttribute("max"), "4");
  max.set(8);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(zoom.getAttribute("max"), "8");
  max.set(2);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(zoom.getAttribute("max"), "2");
  assert.equal(Number(zoom.value), 2, "the zoom is pulled back inside the new limit");
  dispose();
});

test("ImageCropper: can be built with a fixed aspect from the start", () => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const dispose = render(() => h(ImageCropper, { src: "/x.png", aspect: 1, preview: false }), el);
  assert.ok(el.querySelector(".hm-crop-view"));
  assert.equal(el.querySelector(".hm-crop-aspects"), null, "a fixed aspect has no choices");
  dispose();
});
