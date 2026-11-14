import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const C = await import("./color.ts");
const { ColorPicker } = await import("./index.ts");

test("color math: parse any CSS color, HSV round trip, formats, contrast", () => {
  const near = (a, b) => Math.abs(a - b) < 1;
  const o = C.parse("#F2801F");
  assert.ok(near(o.r, 242) && near(o.g, 128) && near(o.b, 31) && o.a === 1);
  assert.equal(C.format(o), "#f2801f");
  assert.equal(C.format(C.parse("rgb(29 154 214 / .5)")), "#1d9ad680");
  assert.equal(C.format(C.parse("hsl(90 52% 49%)"), "rgb"), "rgb(125 190 60)");
  assert.equal(C.format(C.parse("#a3338c"), "hsl"), "hsl(312 52% 42%)");
  assert.equal(C.parse("not a color"), null);
  const hsv = C.rgbToHsv(o);
  assert.equal(C.format(C.hsvToRgb(hsv)), "#f2801f");
  assert.equal(C.rgbToHsv({ r: 128, g: 128, b: 128, a: 1 }, 200).h, 200, "greys keep the hue they had");
  assert.ok(Math.abs(C.contrastOf({ r: 0, g: 0, b: 0, a: 1 }, { r: 255, g: 255, b: 255, a: 1 }) - 21) < 0.01);
});

test("ColorPicker: sliders with values, text input in the chosen format, palettes, contrast", () => {
  const v = signal("#1d9ad6");
  const el = document.createElement("div");
  document.body.appendChild(el);
  const dispose = render(() => h(ColorPicker, { "bind:value": v }), el);
  const sliders = el.querySelectorAll("[role=slider], input[type=range]");
  assert.deepEqual(sliders.map((s) => s.getAttribute("aria-label")), ["Saturation and brightness", "Hue", "Opacity"]);
  assert.equal(sliders[1].value, "199");
  assert.equal(sliders[1].getAttribute("aria-valuetext"), "199 degrees");
  const text = el.querySelector(".hm-cp-text");
  assert.equal(text.value, "#1d9ad6");
  text.value = "rgb(120 190 58)";
  text.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
  assert.equal(v(), "#78be3a");
  // HSL format through the switcher
  el.querySelectorAll(".hm-cp-formats [role=radio]").find((b) => b.textContent === "HSL").click();
  assert.match(v(), /^hsl\(92 53% 49%\)$/);
  const groups = el.querySelectorAll(".hm-cp-palette").map((g) => g.getAttribute("aria-label"));
  assert.deepEqual(groups, ["HADİ colors", "Theme"]);
  assert.equal(el.querySelectorAll(".hm-cp-palette")[0].querySelectorAll("button")[0].getAttribute("aria-label"), "Excitement orange");
  assert.match(el.querySelector(".hm-cp-contrasts").textContent, /on white \d\.\d\d .*on black \d+\.\d\d/);
  dispose();
});

test("ColorPicker: the hue slider changes the value, no alpha when alpha={false}", () => {
  const v = signal("#ff0000");
  const el = document.createElement("div");
  document.body.appendChild(el);
  const dispose = render(() => h(ColorPicker, { "bind:value": v, alpha: false, palettes: false, contrast: false }), el);
  const hue = el.querySelectorAll("input[type=range]").find((s) => s.getAttribute("aria-label") === "Hue");
  hue.value = "10"; hue.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
  assert.equal(hue.value, "10");
  assert.match(v(), /^#ff2[ab]00$/, "hue 10 of a pure red");
  assert.equal(el.querySelectorAll("[role=slider], input[type=range]").length, 2);
  assert.equal(el.querySelector(".hm-cp-palette"), null);
  dispose();
});

test("ColorPicker: preview, format switcher and text field can be turned off; own texts and class", () => {
  const host = document.createElement("div"); document.body.appendChild(host);
  const off = render(() => h(ColorPicker, { value: "#1d9ad6", preview: false, formats: false, input: false, class: "mine", labels: { picker: "Paint", hue: "Tone", theme: "Ours" } }), host);
  const root = host.querySelector(".hm-cp");
  assert.ok(root.classList.contains("mine"));
  assert.equal(root.getAttribute("aria-label"), "Paint");
  assert.equal(root.querySelector(".hm-cp-preview"), null);
  assert.equal(root.querySelector(".hm-cp-formats"), null);
  assert.equal(root.querySelector(".hm-cp-text"), null);
  assert.equal(root.querySelector(".hm-cp-input-row"), null);
  assert.equal(root.querySelector(".hm-cp-slider-hue input").getAttribute("aria-label"), "Tone");
  assert.ok([...root.querySelectorAll(".hm-cp-palette-label")].some((x) => x.textContent === "Ours"));
  off(); host.remove();
  const host2 = document.createElement("div"); document.body.appendChild(host2);
  const on = render(() => h(ColorPicker, { value: "#1d9ad6", formats: false }), host2);
  assert.ok(host2.querySelector(".hm-cp-preview") && host2.querySelector(".hm-cp-text"));
  assert.equal(host2.querySelector(".hm-cp-formats"), null);
  on(); host2.remove();
});
