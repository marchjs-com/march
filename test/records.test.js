import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../src/testing/dom.ts";
const { document } = installDom();
const { render, signal, h } = await import("../src/index.js");
const { schema } = await import("../src/schema/index.ts");
const F = await import("../src/forms/index.ts");

const tick = () => new Promise((r) => setTimeout(r, 0));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const type = (el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };

const fields = { name: { type: "text", label: "Name", required: true }, url: { type: "text", label: "Link", pattern: /^https:\/\// } };

test("RecordListEditor: add, edit, move and remove rows", async () => {
  const v = signal([{ id: "a", name: "A", url: "" }]);
  const { el, dispose } = mount(() => h(F.RecordListEditor, { value: v, fields, addLabel: "Add carrier" }));
  await tick();
  assert.equal(el.querySelectorAll(".hm-records-row").length, 1);
  const add = el.querySelectorAll("button").find((b) => b.textContent === "Add carrier");
  add.click(); await tick();
  assert.equal(v().length, 2);
  const inputs = el.querySelectorAll(".hm-records-row")[1].querySelectorAll("input");
  type(inputs[0], "B"); await tick();
  assert.deepEqual(v()[1], { name: "B", url: "" });
  assert.equal(v()[0].id, "a", "extra keys are kept");
  el.querySelectorAll("button").find((b) => b.getAttribute("aria-label") === "Move up" && !b.disabled).click(); await tick();
  assert.equal(v()[0].name, "B");
  el.querySelectorAll("button").find((b) => b.getAttribute("aria-label") === "Remove").click(); await tick();
  assert.deepEqual(v().map((r) => r.name), ["A"]);
  dispose();
});

test("records schema type validates every row with the sub-schema", () => {
  const s = schema({ carriers: { type: "records", label: "Carriers", fields } });
  assert.equal(s.validateField("carriers", [{ name: "A", url: "https://x" }]), null);
  assert.match(s.validateField("carriers", [{ name: "A" }, { name: "" }]), /Row 2: Name/);
  assert.match(s.validateField("carriers", [{ name: "A", url: "ftp://x" }]), /Row 1: Link/);
  assert.equal(F.validateRecords([{ name: "x" }], fields), null);
  assert.deepEqual(s.parse({ carriers: [{ name: " A ", extra: 1 }] }).carriers, [{ name: " A ", extra: 1 }]);
});

test("records field renders inside a Form via inputFor", async () => {
  const s = schema({ rows: { type: "records", fields: { n: { type: "int", label: "N" } }, addLabel: "More" } });
  let form;
  const { el, dispose } = mount(() => h(F.Form, { schema: s, initial: { rows: [{ n: 1 }] }, onReady: (f) => { form = f; } }));
  await tick();
  assert.equal(el.querySelectorAll(".hm-records-row").length, 1);
  el.querySelectorAll("button").find((b) => b.textContent === "More").click(); await tick();
  assert.equal(form.values.rows.length, 2);
  assert.equal(form.dirty(), true);
  dispose();
});
