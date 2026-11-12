// color prop: every themable control renders data-hm-color; colors.css maps each token to the accent variables;
// themes emit the text and on-fill tones the tokens refer to.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installDom } from "../src/testing/dom.ts";

installDom();
const { h, render } = await import("../src/index.ts");
const U = await import("../src/ui/index.ts");
const { COLOR_TOKENS } = await import("../src/theme/colors.ts");
const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
const mount = (fn) => { const el = document.createElement("div"); render(fn, el); return el; };

test("color prop → data-hm-color on the control (or the group / form root that its children inherit from)", () => {
  const el = mount(() => [
    h(U.TextInput, { color: "brand-blue", "aria-label": "a" }), h(U.Checkbox, { color: "success", label: "b" }), h(U.Toggle, { color: "cat-3", "aria-label": "c" }),
    h(U.Button, { color: "brand-purple", variant: "primary" }, "d"), h(U.Progress, { color: "brand-green", value: 3 }),
    h(U.Segmented, { color: "brand-orange", "aria-label": "e", options: ["x", "y"] }), h(U.CheckboxGroup, { color: "danger", options: ["x"], "aria-label": "f" }),
  ]);
  const colors = [...el.querySelectorAll("[data-hm-color]")].map((x) => x.getAttribute("data-hm-color"));
  for (const c of ["brand-blue", "success", "cat-3", "brand-purple", "brand-green", "brand-orange", "danger"]) assert.ok(colors.includes(c), c);
  assert.equal(mount(() => h(U.TextInput, { "aria-label": "plain" })).querySelector("[data-hm-color]"), null, "no attribute without a color");
});

test("colors.css covers every token; components read the accent with their default as fallback; errors stay danger", () => {
  const css = read("css/colors.css");
  for (const c of COLOR_TOKENS) assert.ok(css.includes(`[data-hm-color="${c}"] { --hm-accent: `), c);
  assert.match(read("forms/inputs.css"), /\.hm-switch\[aria-checked="true"\] \{ background: var\(--hm-accent, var\(--hm-primary\)\); \}/);
  assert.match(read("ui/field.css"), /\.hm-input:focus, \.hm-select:focus \{ outline: none; border-color: var\(--hm-accent, var\(--hm-focus\)\);/);
  assert.match(read("ui/field.css"), /\[aria-invalid="true"\][^{]*\{[^}]*var\(--hm-danger\)/, "invalid fields keep the danger color");
  for (const f of ["hadi", "cream", "night", "neon", "indigo", "minimal", "contrast"]) {
    const t = read(`css/themes/${f}.css`);
    for (const k of ["primary", "info", "success", "warn", "danger", "special"]) assert.match(t, new RegExp(`--hm-on-${k}-fill: #`), `${f} on-${k}-fill`);
    for (let n = 1; n <= 8; n++) assert.match(t, new RegExp(`--hm-cat-${n}-text: #[0-9A-F]{6}; --hm-on-cat-${n}: #`, "i"), `${f} cat-${n}`);
  }
});

test("selection controls: drawn box over a real input, variants, brand colors per option, indeterminate", () => {
  const el = mount(() => [
    h(U.CheckboxGroup, { variant: "chip", colors: "brand", options: ["a", "b", "c", "d", "e"], value: ["a"], "aria-label": "g" }),
    h(U.RadioGroup, { variant: "card", options: [{ value: 1, label: "One", hint: "first" }], value: 1, "aria-label": "r" }),
    h(U.Checkbox, { variant: "soft", size: "lg", shape: "circle", indeterminate: true, label: "x" }),
  ]);
  const [group, radios, single] = el.children;
  assert.match(group.getAttribute("class"), /hm-choices hm-choice hm-choice-chip hm-choice-md hm-shape-rounded/);
  assert.deepEqual([...group.querySelectorAll(".hm-check")].map((l) => l.getAttribute("data-hm-color")), ["brand-orange", "brand-blue", "brand-green", "brand-purple", "brand-orange"]);
  for (const l of group.querySelectorAll(".hm-check")) {
    assert.ok(l.querySelector('input[type="checkbox"].hm-check-input'), "the real input stays (keyboard, forms, screen readers)");
    assert.equal(l.querySelector(".hm-check-box").getAttribute("aria-hidden"), "true");
    assert.ok(l.querySelector(".hm-check-box .hm-check-mark"), "drawn tick");
  }
  assert.ok(radios.querySelector(".hm-radio-dot") && radios.querySelector(".hm-choice-card-title").textContent === "One" && radios.querySelector(".hm-choice-card-desc").textContent === "first");
  assert.match(radios.getAttribute("class"), /hm-shape-circle/, "radios are round");
  assert.match(single.getAttribute("class"), /hm-choice-soft hm-choice-lg hm-shape-circle/);
  assert.equal(single.querySelector("input").indeterminate, true);
  const css = read("forms/choice.css");
  assert.match(css, /\.hm-check-input:checked:not\(:indeterminate\) \+ \.hm-check-box \.hm-check-mark path \{ stroke-dashoffset: 0; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
