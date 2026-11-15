// AppUI (march-app-ui): the top bar, the Layout menu, the side and status slots around a DockLayout.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";

const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { AppUI } = await import("./index.ts");
const { row, col, tabs } = await import("../dock-layout/index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const DEFS = [{ id: "files" }, { id: "editor" }, { id: "preview" }, { id: "console" }, { id: "debug" }];
const PRESET = { title: "Default", tree: () => row([0.2, tabs("files")], [0.45, tabs("editor")], [0.35, col([0.6, tabs("preview")], [0.4, tabs(["console", "debug"])])]) };
const panelsOf = (list) => list.map((d) => ({ ...d, title: d.id.toUpperCase(), content: () => h("p", { class: `body-${d.id}` }, d.id) }));

test("AppUI: top bar with title, tools and the Layout menu; side and status slots; the dock api", () => {
  let api;
  const { el, dispose } = mount(() => h(AppUI, {
    title: "IDE", tools: h("button", { class: "my-tool" }, "Run"), side: h("nav", { class: "my-side" }), status: h("footer", { class: "my-status" }),
    panels: panelsOf(DEFS), presets: { main: PRESET }, commands: false, api: (a) => { api = a; },
  }));
  assert.equal(el.querySelector(".m-app-title").textContent, "IDE");
  assert.ok(el.querySelector(".m-app-bar .my-tool"));
  assert.ok(el.querySelector(".my-side").parentNode.classList.contains("m-app-main"));
  assert.ok(el.querySelector(".my-status").parentNode.classList.contains("m-app"));
  assert.ok(el.querySelector(".m-dock").parentNode.classList.contains("m-app-body"));
  const items = api.layoutMenu();
  assert.ok(items.some((x) => x !== "-" && typeof x.label === "string" && x.label === "Default"), "the presets are in the layout menu");
  dispose();
});

test("plugins: file types open file panels (the highest priority wins), requires order, everything goes with the plugin", async () => {
  const { definePlugin, createAppKit } = await import("./kit.ts");
  const order = [];
  const a = definePlugin({ id: "a", activate(ctx) { order.push("a"); ctx.fileType({ id: "txt", match: /\.txt$/, mount: () => h("i", { class: "low" }) }); ctx.provide("svc", { n: 1 }); } });
  const b = definePlugin({ id: "b", requires: ["a"], activate(ctx) { order.push("b"); ctx.fileType({ id: "txt2", match: /\.txt$/, priority: 2, mount: (f) => h("b", { class: "high" }, f.text()) }); return () => order.push("b-off"); } });
  const kit = createAppKit([b, a]);
  assert.deepEqual(order, ["a", "b"], "b waits for a");
  assert.equal(kit.typeOf("x.txt").id, "txt2");
  assert.equal(kit.service("svc").n, 1);
  kit.remove("a");
  assert.deepEqual(order, ["a", "b", "b-off"], "b goes first: it needs a");
  assert.equal(kit.typeOf("x.txt"), null);
  assert.equal(kit.service("svc"), undefined);
  assert.throws(() => definePlugin({ id: "bad id", activate() {} }));
});

test("AppUI: a panel with a file is drawn by the code editor plugin; without a type it is plain text", async () => {
  const { codeEditorPlugin } = await import("./index.ts");
  const { signal } = await import("../../../index.ts");
  const text = signal("const a = 1");
  const panels = [
    { id: "code", title: "a.tsx", file: { path: "a.tsx", text, set: (v) => text.set(v) } },
    { id: "note", title: "a.txt", file: { path: "a.txt", text: () => "plain" } },
  ];
  const { el, dispose } = mount(() => h(AppUI, { panels, plugins: [codeEditorPlugin()], commands: false }));
  assert.ok(el.querySelector(".m-app-code"), "the code editor opens the .tsx file");
  assert.equal(el.querySelector(".m-app-plain").textContent, "plain");
  dispose();
});

test("AppUI: typing in a file's editor keeps the editor (and its focus): the text change does not rebuild it", async () => {
  const { codeEditorPlugin } = await import("./index.ts");
  const { signal } = await import("../../../index.ts");
  const text = signal("let a = 1");
  const panels = [{ id: "code", title: "a.tsx", file: { path: "a.tsx", text, set: (v) => text.set(v) } }];
  const { el, dispose } = mount(() => h(AppUI, { panels, plugins: [codeEditorPlugin()], commands: false }));
  const area = el.querySelector(".m-ced-input");
  text.set("let a = 12");
  assert.equal(el.querySelector(".m-ced-input"), area, "the same text field");
  dispose();
});
