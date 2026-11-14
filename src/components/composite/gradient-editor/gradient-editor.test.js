import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const G = await import("./gradient.ts");
const { GradientEditor } = await import("./index.ts");

test("gradient: CSS ⇄ data, hand-written forms, color at a point", () => {
  const g = G.parseGradient("linear-gradient(120deg, #f2801f 0%, #a3338c 100%)");
  assert.deepEqual(g, { type: "linear", angle: 120, stops: [{ color: "#f2801f", at: 0 }, { color: "#a3338c", at: 100 }] });
  assert.equal(G.gradientCss(g), "linear-gradient(120deg, #f2801f 0%, #a3338c 100%)");
  const h2 = G.parseGradient("linear-gradient(to right, #f00, rgb(0 0 255), #0f0)");
  assert.equal(h2.angle, 90);
  assert.deepEqual(h2.stops.map((s) => s.at), [0, 50, 100]);
  assert.equal(G.parseGradient("conic-gradient(from 45deg, #000, #fff)").angle, 45);
  assert.equal(G.gradientCss({ type: "radial", angle: 0, stops: [{ color: "#fff", at: 0 }, { color: "#000", at: 100 }] }), "radial-gradient(circle, #fff 0%, #000 100%)");
  assert.equal(G.parseGradient("url(x.png)"), null);
  assert.equal(G.colorAt(g, 50), "#cb5955");
});

test("GradientEditor: stops as sliders, keyboard moves and removes, type and angle change the value", () => {
  const v = signal("linear-gradient(90deg, #f2801f 0%, #1d9ad6 50%, #a3338c 100%)");
  const el = document.createElement("div");
  document.body.appendChild(el);
  const dispose = render(() => h(GradientEditor, { "bind:value": v }), el);
  const stops = () => el.querySelectorAll(".m-ge-stop");
  assert.equal(stops().length, 3);
  assert.equal(stops()[1].getAttribute("aria-valuenow"), "50");
  stops()[1].dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, bubbles: true }));
  assert.equal(v(), "linear-gradient(90deg, #f2801f 0%, #1d9ad6 60%, #a3338c 100%)");
  stops()[1].dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
  assert.equal(stops().length, 2);
  stops()[0].dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
  assert.equal(stops().length, 2, "two stops stay");
  const dial = el.querySelectorAll("[role=slider]").find((s) => s.getAttribute("aria-label") === "Angle");
  dial.dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
  assert.match(v(), /^linear-gradient\(91deg/);
  el.querySelectorAll(".m-ge-types [role=radio]").find((b) => b.textContent === "Conic").click();
  assert.match(v(), /^conic-gradient\(from 91deg/);
  assert.equal(el.querySelector(".m-ge-css").textContent, `background: ${v()};`);
  assert.ok(el.querySelector(".m-cp"), "the selected stop has a ColorPicker");
  dispose();
});

test("GradientEditor: parts off, own angles, own texts", () => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const dispose = render(() => [
    h(GradientEditor, { value: "linear-gradient(90deg, #f2801f 0%, #a3338c 100%)", class: "mine", preview: false, hint: false, position: false, dial: false, angles: [0, 90],
      labels: { editor: "Fill", stops: "Colors", linear: "Straight", degrees: (a) => `${a} deg`, stop: (n) => `Color ${n}`, copy: "Copy it" } }),
    h(GradientEditor, { value: "linear-gradient(90deg, #f2801f 0%, #a3338c 100%)", dial: false, angles: false, presets: false, labels: { hint: "Click to add" } }),
  ], el);
  const [a, b] = el.querySelectorAll(".m-ge");
  assert.ok(a.classList.contains("mine"));
  assert.equal(a.getAttribute("aria-label"), "Fill");
  assert.equal(a.querySelector(".m-ge-preview"), null);
  assert.equal(a.querySelector(".m-ge-hint"), null);
  assert.equal(a.querySelector(".m-ge-pos"), null);
  assert.equal(a.querySelector(".m-ge-dial"), null);
  assert.deepEqual([...a.querySelectorAll(".m-ge-angle-btn")].map((x) => x.getAttribute("aria-label")), ["0 deg", "90 deg"]);
  assert.equal(a.querySelector(".m-ge-bar").getAttribute("aria-label"), "Colors");
  assert.equal(a.querySelector(".m-ge-stop").getAttribute("aria-label"), "Color 1");
  assert.match(a.querySelector(".m-ge-types").textContent, /Straight/);
  assert.equal(a.querySelector(".m-ge-copy").getAttribute("aria-label"), "Copy it");
  assert.ok(b.querySelector(".m-ge-preview") && b.querySelector(".m-ge-pos"), "the default parts stay");
  assert.equal(b.querySelector(".m-ge-angle"), null, "no dial and no quick angles: no angle block");
  assert.equal(b.querySelector(".m-ge-hint").textContent, "Click to add");
  dispose();
});
