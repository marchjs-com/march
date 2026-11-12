// ClipboardManager: async API, fallback, copied() feedback, history, rich copy, paste, copy: props, errors.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { clipboard, configureClipboard } = await import("./index.ts");
const { h, render } = await import("../../index.ts");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let board = "";
Object.defineProperty(globalThis, "navigator", { value: { clipboard: { writeText: async (t) => { board = t; }, readText: async () => board } }, configurable: true });

test("copy text: clipboard, copied() for resetMs, history newest first", async () => {
  configureClipboard({ resetMs: 20, historySize: 2 });
  const c = clipboard();
  assert.equal(await c.copy("one"), true);
  assert.equal(board, "one");
  assert.equal(c.copied(), true);
  await c.copy("two"); await c.copy("three");
  assert.deepEqual(c.history().map((e) => e.text), ["three", "two"]);
  assert.equal(c.last(), "three");
  assert.equal(await c.read(), "three");
  await wait(30);
  assert.equal(c.copied(), false);
});

test("rich copy without ClipboardItem falls back to text; a failing write returns false", async () => {
  configureClipboard({});
  const c = clipboard();
  assert.equal(await c.copy({ text: "plain", html: "<b>plain</b>" }), true);
  assert.equal(board, "plain");
  const prev = navigator.clipboard.writeText;
  navigator.clipboard.writeText = async () => { throw new Error("denied"); };
  assert.equal(await c.copy("x"), false);
  navigator.clipboard.writeText = prev;
});

test("copy: prop and onPaste", async () => {
  configureClipboard({});
  const root = document.createElement("div");
  let link = "https://example.test/a";
  const dispose = render(() => h("button", { "copy:text": () => link }, "Copy"), root);
  root.querySelector("button").dispatchEvent(new Event("click"));
  await wait(0);
  assert.equal(board, "https://example.test/a");
  const got = [];
  const area = document.createElement("div");
  clipboard().onPaste(area, (p) => got.push(p.text));
  const ev = new Event("paste", { cancelable: true });
  ev.clipboardData = { getData: (t) => (t === "text/plain" ? "pasted" : ""), files: [] };
  area.dispatchEvent(ev);
  assert.deepEqual(got, ["pasted"]);
  dispose();
});
