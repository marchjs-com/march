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

test("AppPreview: the stage takes its own theme, mode and accent; each picker is off unless asked for, the bar only shows with one", async () => {
  const { AppPreview } = await import("./index.ts");
  const { signal } = await import("../../../index.ts");
  const theme = signal("neon"), mode = signal("light"), accent = signal("brand-green"), bar = signal(true);
  const { el, dispose } = mount(() => h(AppPreview, { theme, mode, accent, toolbar: bar }, h("p", { class: "shown" }, "x")));
  const stage = el.querySelector(".m-app-pv-stage");
  assert.equal(stage.getAttribute("data-m-theme"), "neon");
  assert.equal(stage.getAttribute("data-theme"), "light");
  assert.equal(el.querySelector(".m-app-pv-accent").getAttribute("data-m-accent"), "brand-green");
  assert.ok(el.querySelector(".m-app-pv-stage .shown"));
  assert.ok(el.querySelector(".m-app-pv-bar .m-theme-toggle"));
  mode.set("system");
  assert.equal(stage.getAttribute("data-theme"), null, "system: the page's mode");
  bar.set({ mode: true });
  assert.ok(el.querySelector(".m-app-pv-bar .m-theme-toggle"));
  assert.equal(el.querySelector(".m-app-pv-bar .m-theme-menu-btn"), null, "a picker not named stays hidden");
  bar.set({});
  assert.equal(el.querySelector(".m-app-pv-bar"), null, "nothing to show: no bar");
  bar.set(false);
  assert.equal(el.querySelector(".m-app-pv-bar"), null);
  dispose();
  const plain = mount(() => h(AppPreview, {}, "x"));
  assert.equal(plain.el.querySelector(".m-app-pv-bar"), null, "by default the bar is hidden");
  plain.dispose();
});

test("marchLanguagePlugin: after import every export, picking writes the whole import; from \"…\" the subpaths", async () => {
  const { marchLanguagePlugin } = await import("./index.ts");
  const { createAppKit } = await import("./kit.ts");
  const catalog = { subpaths: [{ subpath: "hadi-march", items: [["signal", "function"]] }, { subpath: "hadi-march/ui", items: [["Button", "component"], ["ButtonGroup", "component"]] }] };
  const kit = createAppKit([marchLanguagePlugin({ catalog })]);
  const lang = kit.service("language");
  const ask = (value) => lang.complete("a.tsx", { value, caret: value.length, before: value, forced: true, typed: "" });
  const a = await ask("import Bu");
  assert.deepEqual(a.items.map((x) => x.insert), ['{ Button } from "hadi-march/ui"', '{ ButtonGroup } from "hadi-march/ui"']);
  const b = await ask('import { Button } from "hadi-march/');
  assert.deepEqual(b.items.map((x) => x.label), ["hadi-march/ui"]);
  const c = await ask('import { signal } from "hadi-march"\nconst a = sig');
  assert.deepEqual(c.items.map((x) => x.label), ["signal"], "elsewhere: the imported names");
  kit.dispose();
});

test("instrument.js: one-line calls, every line keeps its number; steps, scopes, functions and debugger; statements", async () => {
  const { readFileSync } = await import("node:fs");
  const vm = await import("node:vm");
  const ts = (await import("typescript")).default;
  const box = { self: {} };
  vm.runInNewContext(readFileSync(new URL("./instrument.js", import.meta.url), "utf8"), box);
  const src = 'import { signal } from "hadi-march"\nconst items = signal([1])\nfunction add(x: number) {\n  let z = x + 1\n  if (z > 2) debugger\n  return z\n}\nexport const C = () => <p on:click={() => items.set([2])}>{add(1)}</p>\n';
  const r = JSON.parse(JSON.stringify(box.self.marchInstrument(ts, "a.tsx", src, 0))); // out of the vm context
  assert.equal(r.code.split("\n").length, src.split("\n").length, "no new lines");
  assert.ok(!/\bdebugger\b/.test(r.code), "the debugger statement is our step now");
  const out = ts.transpileModule(r.code, { fileName: "a.tsx", reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2022 } });
  assert.deepEqual(out.diagnostics.map((d) => d.messageText), [], "still valid code");
  assert.deepEqual(r.meta.module, ["items", "add", "C"], "imports are left out");
  assert.deepEqual(r.meta.fns.map((f) => f[0]), ["add", "C", "on:click handler"]);
  const debug = r.meta.steps.find((s) => s[3] === "debugger");
  assert.equal(debug[0], 5);
  assert.deepEqual(debug[4], ["z", "x"], "the local names at that line");
});

test("debuggerPlugin: the debugger and gutter services, the panel; prepare instruments and starts the session", async () => {
  const { debuggerPlugin } = await import("./index.ts");
  const { createAppKit, definePlugin } = await import("./kit.ts");
  let ran = 0;
  const fakeTs = definePlugin({ id: "march.typescript", activate(ctx) { ctx.provide("typescript", { instrument: async (files) => ({ files: Object.fromEntries(Object.entries(files).map(([p, t]) => [p, `/*i*/${t}`])), metas: [{ file: "a.tsx", module: [], fns: [], steps: [] }] }) }); } });
  const kit = createAppKit([fakeTs, debuggerPlugin({ run: () => ran++, keys: false })]);
  const dbg = kit.service("debugger"), gutter = kit.service("gutter");
  assert.ok(kit.panels().some((p) => p.id === "debug"), "the panel");
  gutter.click("a.tsx", 3);
  assert.deepEqual(gutter.marks("a.tsx").map((m) => [m.line, m.kind]), [[3, "breakpoint"]]);
  dbg.session.updateBreakpoint(dbg.session.breakpoints()[0].id, { condition: "x > 1" });
  assert.equal(gutter.marks("a.tsx")[0].kind, "conditional");
  dbg.start();
  assert.equal(ran, 1);
  assert.ok(dbg.active());
  const files = await dbg.prepare({ "a.tsx": "x", "style.css": "a{}" });
  assert.deepEqual(files, { "a.tsx": "/*i*/x", "style.css": "a{}" }, "only scripts are instrumented");
  assert.equal(dbg.session.state(), "running");
  dbg.stop();
  assert.equal(dbg.session.state(), "idle");
  assert.equal(ran, 2, "built again without the calls");
  kit.dispose();
});

test("AppUI: a reactive panel list (a computed) is live: a file opened later gets its tab, a closed one leaves", async () => {
  const { signal, computed } = await import("../../../index.ts");
  const open = signal(["a"]);
  const panels = computed(() => [{ id: "files", title: "F", content: () => h("p", null, "f") },
    ...open().map((p) => ({ id: `f:${p}`, title: p, place: { near: "f:a", zone: "center" }, file: { path: `${p}.js`, text: () => p } }))]);
  const { el, dispose } = mount(() => h(AppUI, { panels, presets: { main: { title: "M", tree: () => row([0.3, tabs("files")], [0.7, tabs("f:a")]) } }, commands: false }));
  const ids = () => [...el.querySelectorAll(".m-dock-panel")].map((e) => e.id.replace(/^.*-p-/, ""));
  assert.deepEqual(ids(), ["files", "f:a"]);
  open.set(["a", "b"]);
  assert.deepEqual(ids(), ["files", "f:a", "f:b"]);
  open.set(["b"]);
  assert.deepEqual(ids(), ["files", "f:b"]);
  dispose();
});
