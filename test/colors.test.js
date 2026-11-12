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
