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
  el.querySelectorAll(".hm-ec-preset").find((b) => b.textContent === "linear").click();
  assert.equal(v(), "cubic-bezier(0, 0, 1, 1)");
  assert.equal(el.querySelectorAll(".hm-ec-preset").find((b) => b.textContent === "linear").getAttribute("aria-pressed"), "true");
  assert.equal(el.querySelector(".hm-ec-css").textContent, "cubic-bezier(0, 0, 1, 1)");
  dispose();
});

test("name: both placeholders filled, even inside literal braces", async () => {
  const { format } = await import("../../../core/i18n.ts");
  assert.equal(format('a "{0}" { b: "{1}" }', { 0: "x", 1: "y" }), 'a "x" { b: "y" }');
  const host = document.createElement("div");
  const dispose = render(() => h(EasingCurveEditor, { value: "ease-out", name: "snap" }), host);
  const p = host.querySelector(".hm-ec-name");
  assert.ok(p && !p.textContent.includes("{1}"), p?.textContent);
  assert.match(p.textContent, /easing: "snap"/);
  dispose();
});
