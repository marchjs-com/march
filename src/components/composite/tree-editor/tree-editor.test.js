import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { reactive } = await import("../../../core/reactive.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const J = await import("./json-path.ts");
const { TreeEditor } = await import("./index.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const tick = () => new Promise((r) => setTimeout(r, 0));

test("json-path: pointers, immutable updates, rename keeps order, conversions", () => {
  const v = { a: 1, "b/c": [true, { d: null }] };
  assert.equal(J.pointer(["b/c", 1, "d"]), "/b~1c/1/d");
  const u = J.updateAt(v, ["b/c", 0], () => false);
  assert.equal(v["b/c"][0], true, "the original is untouched");
  assert.equal(u["b/c"][0], false);
  assert.equal(u["b/c"][1], v["b/c"][1], "untouched branches are shared");
  assert.deepEqual(Object.keys(J.renameAt({ x: 1, y: 2, z: 3 }, ["y"], "w")), ["x", "w", "z"]);
  assert.deepEqual(J.removeAt([1, 2, 3], [1]), [1, 3]);
  assert.deepEqual(J.insertAfter({ a: 1, b: 2 }, ["a"], 0, "n"), { a: 1, n: 0, b: 2 });
  assert.equal(J.freeKey({ key: 1, key2: 1 }), "key3");
  assert.equal(J.convert("12,5", "number"), 12.5);
  assert.equal(J.convert("evet", "boolean"), true);
  assert.deepEqual(J.convert({ a: 1 }, "array"), [1]);
  assert.deepEqual(J.convert("x", "object"), { value: "x" });
});

test("json-path: schema subset reports problems with their paths", () => {
  const schema = { type: "object", required: ["name", "port"], additionalProperties: false, properties: {
    name: { type: "string", minLength: 1 }, port: { type: "integer", minimum: 1, maximum: 65535 },
    mode: { enum: ["dev", "prod"] }, admins: { type: "array", items: { type: "string", format: "email" }, maxItems: 2 },
  } };
  const errs = J.validateJson({ name: "", port: 70000.5, mode: "test", admins: ["a@hadisosyal.com", "nope"], extra: 1 }, schema);
  const by = Object.fromEntries(errs.map((e) => [J.pointer(e.path), e.message]));
  assert.equal(by["/name"], "Cannot be empty");
  assert.match(by["/port"], /Expected whole number/);
  assert.match(by["/mode"], /Must be one of: "dev", "prod"/);
  assert.equal(by["/admins/1"], "Not a valid email");
  assert.equal(by["/extra"], "Field not allowed here");
  assert.deepEqual(J.validateJson({ name: "api", port: 8080 }, schema), []);
  assert.match(J.validateJson({}, schema)[0].message, /Missing required field "name"/);
});

test("TreeEditor: rows, type badges, add / duplicate / delete as undoable steps, validation marks rows", async () => {
  const v = signal({ name: "HADİ", port: 80, debug: false, tags: ["a", "b"], owner: null });
  const schema = { type: "object", properties: { port: { type: "integer", minimum: 1024 } } };
  const { el, dispose } = mount(() => h(TreeEditor, { "bind:value": v, schema }));
  const rows = () => el.querySelectorAll("[role=treeitem]");
  assert.equal(el.querySelector("[role=tree]").getAttribute("aria-label"), "JSON tree");
  assert.equal(rows().length, 8, "root + 5 fields + 2 tag items (2 levels open)");
  const port = rows().find((r) => r.getAttribute("data-ptr") === "/port");
  assert.equal(port.getAttribute("aria-invalid"), "true");
  assert.match(port.textContent, /At least 1024/);
  assert.match(el.querySelector("[role=status]").textContent, /1 problems/);
  assert.deepEqual(rows().map((r) => r.querySelector(".hm-tre-badge")?.textContent), ["{ }", "abc", "123", "0/1", "[ ]", "abc", "abc", "∅"]);
  assert.equal(rows().find((r) => r.getAttribute("data-ptr") === "/debug").querySelector("[role=switch]").getAttribute("aria-checked"), "false");
  // add inside the list, duplicate a field, delete one
  rows().find((r) => r.getAttribute("data-ptr") === "/tags").querySelectorAll("button").find((b) => b.getAttribute("aria-label") === "Add inside").click();
  assert.deepEqual(v().tags, ["a", "b", ""]);
  rows().find((r) => r.getAttribute("data-ptr") === "/name").querySelectorAll("button").find((b) => b.getAttribute("aria-label") === "Duplicate").click();
  assert.deepEqual(Object.keys(v()), ["name", "name_copy", "port", "debug", "tags", "owner"]);
  rows().find((r) => r.getAttribute("data-ptr") === "/owner").querySelectorAll("button").find((b) => b.getAttribute("aria-label") === "Delete").click();
  assert.equal("owner" in v(), false);
  // undo twice with the bar buttons
  const undo = el.querySelectorAll("button").find((b) => b.getAttribute("aria-label") === "Undo");
  undo.click(); await tick();
  assert.equal(v().owner, null);
  undo.click(); await tick();
  assert.deepEqual(Object.keys(v()), ["name", "port", "debug", "tags", "owner"]);
  dispose();
});

test("TreeEditor: search keeps matches and their parents, readonly hides actions", () => {
  const { el, dispose } = mount(() => h(TreeEditor, { value: { a: { deep: "needle" }, b: "hay" }, readonly: true, history: false }));
  const input = el.querySelector("input[type=search]");
  input.value = "needle";
  input.dispatchEvent(new (globalThis.Event)("input", { bubbles: true }));
  assert.deepEqual(el.querySelectorAll("[role=treeitem]").map((r) => r.getAttribute("data-ptr")), ["", "/a", "/a/deep"]);
  assert.equal(el.querySelector(".hm-tre-actions"), null);
  assert.equal(el.querySelector("[role=tree]").getAttribute("aria-readonly"), "true");
  dispose();
});

test("TreeEditor: a switch flips in place (same row element, no redraw); read-only is live", () => {
  const v = signal({ a: true, b: 1 });
  const ro = signal(false);
  const { el, dispose } = mount(() => h(TreeEditor, { "bind:value": v, readonly: reactive(() => ro()) }));
  const row = () => el.querySelectorAll("[role=treeitem]").find((r) => r.getAttribute("data-ptr") === "/a");
  const before = row(), other = el.querySelectorAll("[role=treeitem]").find((r) => r.getAttribute("data-ptr") === "/b");
  v.set({ a: false, b: 1 });
  assert.equal(row(), before, "the row is kept");
  assert.equal(row().querySelector("[role=switch]").getAttribute("aria-checked"), "false");
  assert.equal(el.querySelectorAll("[role=treeitem]").find((r) => r.getAttribute("data-ptr") === "/b"), other, "untouched rows are kept");
  assert.ok(el.querySelector(".hm-tre-actions"));
  ro.set(true);
  assert.equal(el.querySelector(".hm-tre-actions"), null, "read-only takes effect at once");
  assert.match(el.querySelector(".hm-tre-wrap").getAttribute("class"), /is-readonly/);
  dispose();
});
