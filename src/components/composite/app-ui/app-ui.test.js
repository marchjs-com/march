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
