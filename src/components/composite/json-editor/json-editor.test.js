import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { JsonEditor } = await import("./index.ts");

const type = (el, v) => { el.value = v; el.dispatchEvent(new globalThis.Event("input", { bubbles: true })); };

test("JsonEditor: text view with schema problems, tree tab disabled while the text does not parse", async () => {
  const v = signal({ port: 80 });
  const el = document.createElement("div");
  document.body.appendChild(el);
  const schema = { type: "object", properties: { port: { type: "integer", minimum: 1024 } } };
  const dispose = render(() => h(JsonEditor, { "bind:value": v, schema }), el);
  const [text, tree] = el.querySelectorAll("[role=tab]");
  assert.equal(text.getAttribute("aria-selected"), "true");
  assert.match(el.querySelector("[role=status]").textContent, /^\/port: At least 1024$/);
  type(el.querySelector("textarea"), "{ bad");
  assert.equal(tree.getAttribute("aria-disabled"), "true");
  tree.click();
  assert.equal(tree.getAttribute("aria-selected"), "false", "an unparsable text keeps the text view");
  type(el.querySelector("textarea"), '{"port": 8080}');
  assert.deepEqual(v(), { port: 8080 });
  assert.equal(el.querySelector("[role=status]").textContent, "Valid JSON");
  tree.click();
  assert.equal(tree.getAttribute("aria-selected"), "true");
  assert.equal(el.querySelector("textarea"), null);
  dispose();
});

test("JsonEditor: one mode hides the switcher", () => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const dispose = render(() => h(JsonEditor, { value: [1, 2], modes: ["text"] }), el);
  assert.equal(el.querySelector("[role=tablist]"), null);
  assert.equal(el.querySelector("textarea").value, "[\n  1,\n  2\n]");
  dispose();
});

test("JsonEditor: read-only switches at once in the tree view", async () => {
  const { reactive, signal: sig } = await import("../../../core/reactive.ts");
  const ro = sig(false);
  const host = document.createElement("div"); document.body.appendChild(host);
  const dispose = render(() => h(JsonEditor, { value: { a: true }, mode: "tree", readonly: reactive(() => ro()) }), host);
  // the tree view loads on first use
  for (let i = 0; i < 50 && !host.querySelector(".hm-tre-actions"); i++) await new Promise((r) => setTimeout(r, 10));
  assert.ok(host.querySelector(".hm-tre-actions"));
  ro.set(true);
  assert.equal(host.querySelector(".hm-tre-actions"), null);
  dispose();
});
