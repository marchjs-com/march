import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { ease } = await import("../../../motion/engine/ease.ts");
const { EasingCurveEditor, parseBezier, bezierCss } = await import("./index.ts");

test("bezier: parse CSS and engine names, write compact CSS", () => {
  assert.deepEqual(parseBezier("cubic-bezier(0.34, 1.56, 0.64, 1)"), [0.34, 1.56, 0.64, 1]);
  assert.deepEqual(parseBezier("expo"), [0.16, 1, 0.3, 1]);
  assert.deepEqual(parseBezier("cubic-bezier(1.5, 0, -1, 1)"), [1, 0, 0, 1], "x stays within 0–1");
  assert.equal(parseBezier("steps(4)"), null);
  assert.equal(bezierCss([0.25, 0.1, 0.25, 1]), "cubic-bezier(.25, .1, .25, 1)");
});

test("EasingCurveEditor: handles as sliders, keyboard edits, presets, registers the curve in the engine", () => {
  const v = signal("out");
  const el = document.createElement("div");
  document.body.appendChild(el);
  const dispose = render(() => h(EasingCurveEditor, { "bind:value": v, name: "test-curve", preview: "none" }), el);
  const knobs = el.querySelectorAll("[role=slider]");
  assert.equal(knobs.length, 2);
  assert.equal(knobs[0].getAttribute("aria-valuetext"), "time .33, progress 1");
  knobs[0].dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "ArrowUp", shiftKey: true, bubbles: true }));
  assert.equal(v(), "cubic-bezier(.33, 1.1, .68, 1)");
  assert.equal(ease("test-curve").css, "cubic-bezier(0.33,1.1,0.68,1)", "registered in the engine by name");
  el.querySelectorAll(".m-ec-preset").find((b) => b.textContent === "linear").click();
  assert.equal(v(), "cubic-bezier(0, 0, 1, 1)");
  assert.equal(el.querySelectorAll(".m-ec-preset").find((b) => b.textContent === "linear").getAttribute("aria-pressed"), "true");
  assert.equal(el.querySelector(".m-ec-css").textContent, "cubic-bezier(0, 0, 1, 1)");
  dispose();
});

test("name: both placeholders filled, even inside literal braces", async () => {
  const { format } = await import("../../../core/i18n.ts");
  assert.equal(format('a "{0}" { b: "{1}" }', { 0: "x", 1: "y" }), 'a "x" { b: "y" }');
  const host = document.createElement("div");
  const dispose = render(() => h(EasingCurveEditor, { value: "ease-out", name: "snap" }), host);
  const p = host.querySelector(".m-ec-name");
  assert.ok(p && !p.textContent.includes("{1}"), p?.textContent);
  assert.match(p.textContent, /easing: "snap"/);
  dispose();
});

test("EasingCurveEditor: own texts, parts off, handle colors", () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const dispose = render(() => [
    h(EasingCurveEditor, { value: "out", name: "mine", preview: "none", class: "own", handleColors: ["brand-purple", "brand-green"],
      labels: { firstHandle: "Start", secondHandle: "End", presets: "Ready", curve: (c) => `Curve ${c}`, handleValue: (a, b) => `${a}/${b}`, controlPoint: (l) => `P ${l}`, registered: (n) => `Saved as ${n}` } }),
    h(EasingCurveEditor, { value: "out", name: "mine2", preview: "none", inputs: false, cssLine: false, nameNote: false, grid: false, presets: false }),
  ], host);
  const [a, b] = host.querySelectorAll(".m-ec");
  assert.ok(a.classList.contains("own"));
  const knobs = a.querySelectorAll("[role=slider]");
  assert.deepEqual([knobs[0].getAttribute("aria-label"), knobs[1].getAttribute("aria-label")], ["Start", "End"]);
  assert.equal(knobs[0].getAttribute("aria-valuetext"), ".33/1");
  assert.equal(a.querySelector(".m-ec-presets").getAttribute("aria-label"), "Ready");
  assert.equal(a.querySelector(".m-ec-plot").getAttribute("aria-label"), "Curve cubic-bezier(.33, 1, .68, 1)");
  assert.equal(a.querySelector(".m-ec-num").getAttribute("aria-label"), "P x1");
  assert.equal(a.querySelector(".m-ec-name").textContent, "Saved as mine");
  assert.match(a.style.getPropertyValue("--m-ec-h1"), /brand-purple/);
  assert.match(a.style.getPropertyValue("--m-ec-h2"), /brand-green/);
  assert.equal(a.querySelectorAll(".m-ec-grid").length, 6);
  assert.equal(b.querySelector(".m-ec-inputs"), null);
  assert.equal(b.querySelector(".m-ec-css"), null);
  assert.equal(b.querySelector(".m-ec-name"), null);
  assert.equal(b.querySelector(".m-ec-presets"), null);
  assert.equal(b.querySelectorAll(".m-ec-grid").length, 0);
  assert.equal(b.querySelectorAll(".m-ec-axis").length, 4);
  assert.equal(b.style.getPropertyValue("--m-ec-h1"), "");
  dispose();
});
