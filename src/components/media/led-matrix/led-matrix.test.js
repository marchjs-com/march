import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { LedMatrix } = await import("./index.ts");
const { ledFrame, ledArt, setLed, ledAt, blit, ledColor, copyFrame, isLedFrame, ledNoise } = await import("./frame.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("LED frames: art, colors, blit with clipping, copy", () => {
  const art = ledArt([".#.", "#r#"], { r: "#ff0000" });
  assert.equal(art.cols, 3); assert.equal(art.rows, 2);
  assert.equal(ledAt(art, 1, 0), 255); assert.equal(ledAt(art, 0, 0), 0); assert.equal(ledAt(art, 9, 9), 0);
  assert.equal(art.rgb[4], 0xff0000 + 1, "a palette character keeps its color");
  assert.equal(art.rgb[3], 0, "other characters use the matrix color");
  assert.equal(ledColor("#f80"), 0xff8800 + 1); assert.equal(ledColor("red"), 0); assert.equal(ledColor(0), 1);
  const f = ledFrame(4, 2);
  blit(f, art, 2, 0); // the right column falls off the frame
  assert.deepEqual([...f.lit], [0, 0, 0, 255, 0, 0, 255, 255]);
  setLed(f, -1, 0); setLed(f, 0, 0, 128);
  assert.equal(f.lit[0], 128);
  const g = ledFrame(4, 2); copyFrame(g, f);
  assert.deepEqual([...g.lit], [...f.lit]);
  assert.ok(isLedFrame(g) && !isLedFrame({}));
  const n = ledNoise(3, 4);
  assert.ok(n >= 0 && n < 1 && n === ledNoise(3, 4) && n !== ledNoise(4, 3));
});

test("LedMatrix: a labelled image with its size, look classes and color attributes", () => {
  const color = signal("amber"), shape = signal("round");
  const [el, dispose] = mount(() => h(LedMatrix, { frame: [".#.#.", "#####", ".###.", "..#.."], color, shape, scanlines: true, label: "Heart", pitch: 10 }));
  const root = el.querySelector(".m-led");
  assert.equal(root.getAttribute("role"), "img");
  assert.equal(root.getAttribute("aria-label"), "Heart");
  assert.equal(root.style.getPropertyValue("--m-led-cols"), "5");
  assert.equal(root.style.getPropertyValue("--m-led-rows"), "4");
  assert.equal(root.style.getPropertyValue("--m-led-w"), "50px");
  assert.ok(root.classList.contains("m-led-round") && root.classList.contains("is-scanlined") && root.classList.contains("m-led-panel-dark"));
  assert.equal(root.getAttribute("data-m-led"), "amber");
  assert.ok(root.querySelector("canvas.m-led-canvas") && root.querySelector("canvas.m-led-halo"));
  color.set("brand-pink"); shape.set("tube");
  assert.equal(root.getAttribute("data-m-led"), null);
  assert.equal(root.getAttribute("data-m-color"), "brand-pink");
  assert.ok(root.classList.contains("m-led-tube"));
  color.set("rgb");
  assert.equal(root.getAttribute("data-m-color"), null);
  dispose();
});

test("LedMatrix: cols / rows give a bigger screen, bloom false drops the halo, default name", () => {
  const [el, dispose] = mount(() => h(LedMatrix, { frame: ["#"], cols: 9, rows: 3, bloom: false, panel: "none" }));
  const root = el.querySelector(".m-led");
  assert.equal(root.style.getPropertyValue("--m-led-cols"), "9");
  assert.equal(root.querySelector(".m-led-halo"), null);
  assert.equal(root.getAttribute("aria-label"), "LED display");
  assert.ok(root.classList.contains("m-led-panel-none"));
  dispose();
});
