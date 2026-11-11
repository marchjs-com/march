import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, renderTest } from "../src/testing/index.js";
installDom();
const { h } = await import("../src/index.js");
const { schema } = await import("../src/schema/index.js");
const { crud } = await import("../src/crud/index.js");

test("crud: lists, creates, edits and deletes through the source", async () => {
  let rows = [{ id: 1, name: "Ada", status: "live" }, { id: 2, name: "Grace", status: "draft" }];
  let nextId = 3;
  const calls = [];
  const source = {
    list: async () => { calls.push("list"); return rows; },
    create: async (v) => { calls.push(["create", v]); rows = [...rows, { id: nextId++, ...v }]; },
    update: async (id, v, ctx) => { calls.push(["update", id, ctx.changed]); rows = rows.map((r) => (r.id === id ? { ...r, ...v } : r)); },
    remove: async (id) => { calls.push(["remove", id]); rows = rows.filter((r) => r.id !== id); },
  };
  const S = schema({ name: { type: "text", required: true }, status: { type: "pick", options: ["draft", "live"], default: "draft" } });
  const s = renderTest(() => h("div", {}, crud(source, { schema: S, mode: "client", title: "People" })));
  await s.wait(() => s.sees("Grace"));
  assert.ok(s.sees("Ada"));

  await s.click("New");
  await s.type(s.get("[role=dialog] input"), "Linus");
  await s.submit("[role=dialog] form");
  await s.wait(() => s.sees("Linus"));
  assert.deepEqual(calls.find((c) => c[0] === "create")[1].name, "Linus");

  await s.click("Grace");
  await s.wait(() => !!s.get("[role=dialog] form"));
  await s.type(s.get("[role=dialog] input"), "Grace H.");
  await s.submit("[role=dialog] form");
  await s.wait(() => s.sees("Grace H."));
  assert.deepEqual(calls.find((c) => c[0] === "update").slice(1), [2, { name: "Grace H." }]);
  s.dispose();
});
