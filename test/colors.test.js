// color prop: every themable control renders data-m-color; colors.css maps each token to the accent variables;
// themes emit the text and on-fill tones the tokens refer to.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installDom } from "../src/testing/dom.ts";
const { mProps } = await import("../src/props/index.ts");

installDom();
const { h, render } = await import("../src/index.ts");
const U = await import("../src/ui/index.ts");
const { COLOR_TOKENS } = await import("../src/theme/colors.ts");
const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
const mount = (fn) => { const el = document.createElement("div"); render(fn, el); return el; };

test("m:color (and Progress's own color) → data-m-color on the control's root, which its parts inherit", () => {
  const el = mount(() => [
    mProps(h(U.TextInput, { "aria-label": "a" }), { color: "brand-blue" }), mProps(h(U.Checkbox, { label: "b" }), { color: "success" }), mProps(h(U.Toggle, { "aria-label": "c" }), { color: "cat-3" }),
    mProps(h(U.Button, { variant: "primary" }, "d"), { color: "brand-purple" }), h(U.Progress, { color: "brand-green", value: 3 }),
    mProps(h(U.Segmented, { "aria-label": "e", options: ["x", "y"] }), { color: "brand-orange" }), mProps(h(U.CheckboxGroup, { options: ["x"], "aria-label": "f" }), { color: "danger" }),
  ]);
  const colors = [...el.querySelectorAll("[data-m-color]")].map((x) => x.getAttribute("data-m-color"));
  for (const c of ["brand-blue", "success", "cat-3", "brand-purple", "brand-green", "brand-orange", "danger"]) assert.ok(colors.includes(c), c);
  assert.equal(mount(() => h(U.TextInput, { "aria-label": "plain" })).querySelector("[data-m-color]"), null, "no attribute without a color");
});

test("colors.css covers every token; components read the accent with their default as fallback; errors stay danger", () => {
  const css = read("css/colors.css");
  for (const c of COLOR_TOKENS) assert.ok(css.includes(`[data-m-color="${c}"] { --m-accent: `), c);
  assert.match(read("components/forms/toggle/toggle.css"), /\.m-switch\[aria-checked="true"\] \{ background: var\(--m-accent, var\(--m-primary\)\); \}/);
  assert.match(read("ui/field.css"), /\.m-input:focus, \.m-select:focus \{ outline: none; border-color: var\(--m-accent, var\(--m-focus\)\);/);
  assert.match(read("ui/field.css"), /\[aria-invalid="true"\][^{]*\{[^}]*var\(--m-danger\)/, "invalid fields keep the danger color");
  for (const f of ["hadi", "cream", "night", "neon", "indigo", "minimal", "contrast", "aurora", "noir-gold", "ember", "voyage", "graphite", "paper", "mint", "candy"]) {
    const t = read(`css/themes/${f}.css`);
    for (const k of ["primary", "info", "success", "warn", "danger", "special"]) assert.match(t, new RegExp(`--m-on-${k}-fill: #`), `${f} on-${k}-fill`);
    for (let n = 1; n <= 8; n++) assert.match(t, new RegExp(`--m-cat-${n}-text: #[0-9A-F]{6}; --m-on-cat-${n}: #`, "i"), `${f} cat-${n}`);
  }
});

test("selection controls: drawn box over a real input, variants, brand colors per option, indeterminate", () => {
  const el = mount(() => [
    h(U.CheckboxGroup, { variant: "chip", colors: "brand", options: ["a", "b", "c", "d", "e"], value: ["a"], "aria-label": "g" }),
    h(U.RadioGroup, { variant: "card", options: [{ value: 1, label: "One", hint: "first" }], value: 1, "aria-label": "r" }),
    h(U.Checkbox, { variant: "soft", size: "lg", shape: "circle", indeterminate: true, label: "x" }),
  ]);
  const [group, radios, single] = el.children;
  assert.match(group.getAttribute("class"), /m-choices m-choice m-choice-chip m-choice-md m-shape-circle/);
  assert.deepEqual([...group.querySelectorAll(".m-check")].map((l) => l.getAttribute("data-m-color")), ["brand-orange", "brand-blue", "brand-green", "brand-purple", "brand-orange"]);
  for (const l of group.querySelectorAll(".m-check")) {
    assert.ok(l.querySelector('input[type="checkbox"].m-check-input'), "the real input stays (keyboard, forms, screen readers)");
    assert.equal(l.querySelector(".m-check-box").getAttribute("aria-hidden"), "true");
    assert.ok(l.querySelector(".m-check-box .m-check-mark"), "drawn tick");
  }
  assert.ok(!radios.querySelector(".m-radio-dot") && radios.querySelector(".m-check-mark"), "a radio card shows a tick badge, not a dot");
  assert.ok(radios.querySelector(".m-choice-card-title").textContent === "One" && radios.querySelector(".m-choice-card-desc").textContent === "first");
  assert.match(radios.getAttribute("class"), /m-choice-radio/, "radio boxes are round (CSS)");
  assert.match(single.getAttribute("class"), /m-choice-soft m-choice-lg m-shape-circle/);
  assert.equal(single.querySelector("input").indeterminate, true);
  const css = read("forms/choice.css");
  assert.match(css, /\.m-check-input:checked:not\(:indeterminate\) \+ \.m-check-box \.m-check-mark path \{ stroke-dashoffset: 0; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("selection controls: size and shape change every variant; impossible shapes are reported", async () => {
  const U2 = await import("../src/forms/choice.ts");
  const css = read("forms/choice.css");
  // size and shape act through variables that every variant reads
  for (const v of ["--m-ch-size", "--m-ch-pad-y", "--m-ch-card-pad", "--m-ch-icon"]) assert.match(css, new RegExp(`\.m-choice-(sm|lg) \{[^}]*${v}:`), v);
  for (const v of ["--m-ch-radius", "--m-ch-item-radius", "--m-ch-card-radius"]) assert.match(css, new RegExp(`\.m-choice\.m-shape-square \{[^}]*${v}:`), v);
  assert.match(css, /\.m-choice-chip \.m-check \{[^}]*padding: var\(--m-ch-pad-y\) var\(--m-ch-pad-x\); border: var\(--m-border-w, 1px\) solid var\(--m-border-strong\); border-radius: var\(--m-ch-item-radius\)/);
  assert.match(css, /\.m-choice-toggle \.m-check, \.m-choice-segmented \.m-check \{[^}]*padding: var\(--m-ch-pad-y\) var\(--m-ch-pad-x\); border-radius: var\(--m-ch-item-radius\)/);
  assert.match(css, /border-radius: var\(--m-ch-card-radius\)/);
  assert.deepEqual(U2.shapesFor("card", "checkbox"), ["square", "rounded"]);
  assert.deepEqual(U2.shapesFor("classic", "radio"), []);
  assert.deepEqual(U2.shapesFor("chip", "radio"), ["square", "rounded", "circle"]);
  for (const v of ["classic", "soft", "chip", "card", "toggle"]) for (const size of ["sm", "md", "lg"]) assert.match(U2.lookClass({ variant: v, size }, "checkbox"), new RegExp(`m-choice-${v} m-choice-${size}`));
});

test("app accent: setAccent remaps the primary family on <html>, is remembered, and primary means the current accent", async () => {
  const A = await import("../src/ui/accent.ts");
  localStorage.clear();
  assert.equal(A.setAccent("brand-green"), "brand-green");
  assert.equal(document.documentElement.getAttribute("data-m-accent"), "brand-green");
  assert.equal(JSON.parse(localStorage.getItem("m.accent")), "brand-green");
  assert.equal(A.setAccent("primary"), "primary");
  assert.equal(document.documentElement.getAttribute("data-m-accent"), null);
  assert.equal(A.setAccent("not-a-token"), "primary", "unknown names fall back to the theme");
  const css = read("ui/accent.css");
  assert.match(css, /:root\[data-m-accent="brand-green"\]\[data-m-accent\], \[data-m-accent="brand-green"\] \{ --m-primary: var\(--m-brand-green, var\(--m-cat-3\)\); --m-primary-solid: /);
  assert.match(css, /--m-progress-fill: var\(--m-brand-green, var\(--m-cat-3\)\); --m-spinner-paint: none;/, "an accent replaces the multicolor defaults");
  assert.doesNotMatch(css, /data-m-accent="primary"/);
  assert.match(read("css/colors.css"), /\[data-m-color="primary"\] \{ --m-accent: var\(--m-primary\);/, "primary = the current (possibly remapped) primary");
  const { execFileSync } = await import("node:child_process");
  assert.match(execFileSync(process.execPath, ["tools/gen-accent.js", "--check"], { encoding: "utf8" }), /up to date/);
});

test("CodeInput: length 3–12, pattern, groups, brand colors per box, paste trims and completes", async () => {
  let done = null;
  const el = mount(() => h(U.CodeInput, { length: 4, groups: [2, 2], colors: "brand", font: "mono", size: "lg", variant: "filled", onComplete: (c) => { done = c; }, "aria-label": "c" }));
  const g = el.querySelector(".m-otp");
  assert.match(g.getAttribute("class"), /m-otp m-otp-lg m-otp-filled m-otp-font-mono/);
  assert.equal(g.getAttribute("dir"), "ltr", "codes read left to right");
  const boxes = [...g.querySelectorAll(".m-otp-box")];
  assert.equal(boxes.length, 4);
  assert.equal(g.querySelectorAll(".m-otp-sep").length, 1, "one separator between [2, 2]");
  assert.deepEqual(boxes.map((b) => b.getAttribute("data-m-color")), ["brand-orange", "brand-blue", "brand-green", "brand-purple"]);
  assert.equal(boxes[0].getAttribute("autocomplete"), "one-time-code");
  assert.equal(boxes[0].getAttribute("inputmode"), "numeric");
  const ev = new Event("paste", { bubbles: true, cancelable: true });
  ev.clipboardData = { getData: () => "98-76 54 32" };
  boxes[0].dispatchEvent(ev);
  assert.deepEqual(boxes.map((b) => b.value), ["9", "8", "7", "6"], "non-digits dropped, extra characters cut");
  assert.equal(done, "9876");
  assert.equal(mount(() => h(U.CodeInput, { length: 40 })).querySelectorAll(".m-otp-box").length, 12, "length clamped to 12");
  assert.equal(mount(() => h(U.CodeInput, { length: 1 })).querySelectorAll(".m-otp-box").length, 3, "length clamped to 3");
  const a = mount(() => h(U.CodeInput, { length: 3, pattern: "alpha" })).querySelector(".m-otp-box");
  a.value = "7"; a.dispatchEvent(new Event("input", { bubbles: true })); assert.equal(a.value, "", "alpha drops digits");
  a.value = "ş"; a.dispatchEvent(new Event("input", { bubbles: true })); assert.equal(a.value, "Ş", "letters are upper-cased (locale aware)");
  assert.match(read("theme/css.ts"), /--m-otp-1: \$\{a\}; --m-otp-2: \$\{b\}; --m-otp-3: \$\{d\}; --m-otp-4: \$\{e\}; --m-otp-font: var\(--m-font-display\);/, "HADİ default: brand colors + display font");
});

test("Rating follows the accent (gold on request); multicolor components are marked", () => {
  const css = read("components/forms/rating/rating.css");
  assert.match(css, /\.m-rating-on \{ color: var\(--m-accent, var\(--m-primary\)\);/);
  assert.match(css, /\.m-rating\.is-hovering \.m-rating-on \{ color: color-mix\(/, "hover preview in a lighter tone");
  assert.ok(COLOR_TOKENS.includes("gold"));
  assert.ok(read("css/colors.css").includes('[data-m-color="gold"] { --m-accent: var(--m-brand-gold, var(--m-cat-6));'));
  const el = mount(() => [h(U.Progress, { value: 3, colors: "brand" }), h(U.Progress, { value: 3 }), h(U.CodeInput, { length: 3, colors: "brand" })]);
  assert.deepEqual([...el.querySelectorAll("[data-m-colors]")].map((x) => x.getAttribute("data-m-colors")), ["brand", "brand"]);
});

test("a color prop stays live: a new value reaches data-m-color (the showcase Playground changes it)", async () => {
  const { signal, reactive } = await import("../src/core/reactive.ts");
  const { Stepper } = await import("../src/components/navigation/stepper/index.ts");
  const color = signal("brand-blue");
  const cases = [
    ["Steps (m:color)", (c) => mProps(h(U.Steps, { steps: [{ title: "A" }, { title: "B" }], current: 0 }), { color: c })],
    ["Progress", (c) => h(U.Progress, { value: 1, max: 2, color: c })],
    ["Badge (m:color)", (c) => mProps(h(U.Badge, {}, "x"), { color: c })],
    ["Stepper (m:color)", (c) => mProps(h(Stepper, { steps: [{ title: "A" }, { title: "B" }] }), { color: c })],
  ];
  for (const [name, make] of cases) {
    const el = document.createElement("div"); document.body.appendChild(el);
    color.set("brand-blue");
    const dispose = render(() => make(reactive(() => color())), el);
    const node = el.querySelector("[data-m-color]");
    assert.equal(node?.getAttribute("data-m-color"), "brand-blue", name);
    color.set("brand-purple");
    assert.equal(node.getAttribute("data-m-color"), "brand-purple", `${name}: the new color reaches it`);
    dispose();
  }
});
