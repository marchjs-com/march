import { test } from "node:test";
import assert from "node:assert/strict";
const { mProps } = await import("../../../props/index.ts");
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { FormatToolbar, FORMAT_TOOLS, formatShortcut, formatToolName } = await import("./index.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const names = (el) => [...el.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"));

test("FormatToolbar: a named toolbar with the default tools, one Tab stop, shortcuts as aria-keyshortcuts", () => {
  const ran = [];
  const [el, dispose] = mount(() => h(FormatToolbar, { onTool: (tool) => ran.push(tool) }));
  const bar = el.querySelector("[role=toolbar]");
  assert.equal(bar.getAttribute("aria-label"), "Formatting");
  assert.deepEqual(names(el), FORMAT_TOOLS.filter((x) => x !== "|").map(formatToolName));
  assert.equal(el.querySelectorAll("[role=separator]").length, 2);
  const buttons = [...el.querySelectorAll("button")];
  assert.equal(buttons.filter((b) => b.getAttribute("tabindex") === "0").length, 1);
  assert.equal(buttons[0].getAttribute("aria-keyshortcuts"), "Control+B");
  assert.equal(buttons[0].getAttribute("title"), "Bold");
  buttons[1].click();
  assert.deepEqual(ran, ["italic"]);
  dispose();
});

test("FormatToolbar: own tools, names, icons, keys, hints, pressed, disabled, colour, size, class", () => {
  const on = signal(false), color = signal("brand-green");
  const [el, dispose] = mount(() => mProps(h(FormatToolbar, {
    tools: ["bold", "|", "link", "undo"], onTool: () => {}, label: "Text style", labels: { bold: "Strong" }, name: (tool) => (tool === "link" ? "Address" : undefined),
    icons: { bold: "B", link: false }, keys: { link: false, undo: "Control+Z" }, hints: true, pressed: { bold: on }, disabled: (tool) => tool === "undo",
    size: "md", prefix: "my-ed", class: "mine", attrs: (tool) => (tool === "link" ? { "aria-haspopup": "dialog" } : {}),
  }), { color }));
  const bar = el.querySelector("[role=toolbar]");
  assert.equal(bar.getAttribute("aria-label"), "Text style");
  assert.ok(bar.classList.contains("mine") && bar.classList.contains("my-ed-toolbar"));
  assert.equal(bar.getAttribute("data-m-color"), "brand-green");
  color.set(undefined);
  assert.equal(bar.getAttribute("data-m-color"), null);
  assert.deepEqual(names(el), ["Strong", "Address", "Undo"]);
  const [b, link, undo] = [...el.querySelectorAll("button")];
  assert.equal(b.querySelector(".m-format-tool-own.my-ed-tool-own").textContent, "B");
  assert.match(b.getAttribute("title"), /^Strong \(.*B\)$/);
  assert.equal(b.getAttribute("aria-pressed"), "false");
  on.set(true);
  assert.equal(b.getAttribute("aria-pressed"), "true");
  assert.ok(b.classList.contains("is-pressed") && b.classList.contains("my-ed-tool"));
  assert.equal(link.querySelector("svg"), null, "icons: false draws none");
  assert.equal(link.getAttribute("aria-keyshortcuts"), null, "keys: false removes the shortcut");
  assert.equal(link.getAttribute("title"), "Address");
  assert.equal(link.getAttribute("aria-haspopup"), "dialog");
  assert.equal(undo.disabled, true);
  assert.equal(undo.getAttribute("aria-keyshortcuts"), "Control+Z");
  assert.ok(el.querySelector(".m-format-sep.my-ed-sep"));
  dispose();
});

test("formatShortcut: the tool of a formatting key", () => {
  const key = (k, more = {}) => ({ key: k, code: "", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, ...more });
  assert.equal(formatShortcut(key("b")), "bold");
  assert.equal(formatShortcut(key("K")), "link");
  assert.equal(formatShortcut(key("x", { shiftKey: true })), "strike");
  assert.equal(formatShortcut(key("b", { ctrlKey: false })), undefined);
  assert.equal(formatShortcut(key("q")), undefined);
});
