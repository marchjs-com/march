// The four bugs from the duplicate audit (march_tekrar_denetimi.md › Bugs found along the way).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installDom, Event } from "../src/testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../src/index.ts");
const F = await import("../src/forms/index.ts");
const { schema } = await import("../src/schema/index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

test("1: table danger actions use the button's real class (m-btn-danger)", () => {
  const src = readFileSync(new URL("../src/table/render.ts", import.meta.url), "utf8");
  assert.ok(!src.includes("m-btn--danger"));
  assert.ok(readFileSync(new URL("../src/components/actions/button/button.css", import.meta.url), "utf8").includes(".m-btn-danger"));
});

test("2: Wizard progress is the Progress component (styled by its own CSS)", () => {
  const m = mount(() => h(F.Wizard, { steps: [{ title: "A", schema: schema({ a: { type: "text" } }) }, { title: "B", schema: schema({ b: { type: "text" } }) }] }));
  const bar = m.el.querySelector(".m-wizard-progress");
  assert.ok(bar && bar.className.includes("m-progress2"));
  assert.equal(m.el.querySelector("[role=progressbar]").getAttribute("aria-valuenow"), "1");
  m.dispose();
});

test("3: Combobox search folds Turkish İ / ı like Table, Nav and Palette", async () => {
  const m = mount(() => h(F.Combobox, { options: ["İstanbul", "Iğdır", "Ankara"], "aria-label": "Şehir" }));
  const input = m.el.querySelector("input");
  input.value = "ıstan"; input.dispatchEvent(new Event("input", { bubbles: true }));
  await tick(300);
  const opts = [...document.body.querySelectorAll("[role=option]")].map((o) => o.textContent);
  assert.ok(opts.some((t) => t.includes("İstanbul")), opts.join(","));
  m.dispose();
});

test("4: form controls take the same class prop as ui components (array, object, accessor)", () => {
  const m = mount(() => [h(F.TextInput, { class: ["a", { b: true, c: false }] }), h(F.Textarea, { class: () => "d" })]);
  const [i, t] = [m.el.querySelector("input"), m.el.querySelector("textarea")];
  assert.ok(i.classList.contains("a") && i.classList.contains("b") && !i.classList.contains("c"));
  assert.ok(t.classList.contains("d"));
  m.dispose();
});

test("per-option colors (colors=\"brand\") reach the drawn box: the derived --m-ch-* colors are worked out again on the option", () => {
  const css = readFileSync(new URL("../src/forms/choice.css", import.meta.url), "utf8");
  const rule = css.match(/\.m-choice \[data-m-color\] \{([^}]*)\}/);
  assert.ok(rule, "a rule on the option");
  for (const v of ["--m-ch-c", "--m-ch-on", "--m-ch-soft", "--m-ch-text"]) assert.match(rule[1], new RegExp(v + ":"));
});
