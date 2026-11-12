import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { dropzone, accepts } = await import("./index.ts");

const file = (name, type) => ({ name, type });
const drag = (type, files = [], types = ["Files"]) => { const e = new Event(type, { bubbles: true, cancelable: true }); e.dataTransfer = { types, files, dropEffect: "none" }; return e; };

test("accepts: <input accept> syntax", () => {
  assert.equal(accepts(file("a.PDF", ""), ".pdf"), true);
  assert.equal(accepts(file("a.png", "image/png"), "image/*"), true);
  assert.equal(accepts(file("a.csv", "text/csv"), "image/*, text/csv"), true);
  assert.equal(accepts(file("a.txt", "text/plain"), "image/*,.pdf"), false);
  assert.equal(accepts(file("a.txt", "text/plain"), ""), true);
});

test("dropzone: counted enter / leave (children do not flicker), files only, accept + reject, single, cleanup", () => {
  const zone = document.createElement("div"), child = document.createElement("span");
  zone.appendChild(child); document.body.appendChild(zone);
  const log = [];
  const off = dropzone(zone, { accept: "image/*", single: true, onOver: (on) => log.push(`over ${on}`), onFiles: (f) => log.push(`files ${f.map((x) => x.name)}`), onReject: (f) => log.push(`reject ${f.map((x) => x.name)}`) });
  const enter = drag("dragenter"); zone.dispatchEvent(enter);
  assert.equal(enter.defaultPrevented, true);
  child.dispatchEvent(drag("dragenter")); zone.dispatchEvent(drag("dragleave"));
  assert.deepEqual(log, ["over true"], "moving onto a child keeps it over");
  assert.equal(zone.classList.contains("is-drop-over"), true);
  const over = drag("dragover"); zone.dispatchEvent(over);
  assert.equal(over.dataTransfer.dropEffect, "copy");
  child.dispatchEvent(drag("drop", [file("a.png", "image/png"), file("b.png", "image/png"), file("c.txt", "text/plain")]));
  assert.deepEqual(log, ["over true", "over false", "reject c.txt", "files a.png"]);
  log.length = 0;
  const text = drag("dragenter", [], ["text/plain"]); zone.dispatchEvent(text);
  assert.equal(text.defaultPrevented, false, "a dragged link or text is left alone");
  assert.deepEqual(log, []);
  off();
  zone.dispatchEvent(drag("dragenter"));
  assert.deepEqual(log, []);
});

test("dropzone: paste when asked, disabled refuses", () => {
  const zone = document.createElement("div"); document.body.appendChild(zone);
  let off = false; const got = [];
  dropzone(zone, { paste: true, disabled: () => off, onFiles: (f) => got.push(...f.map((x) => x.name)) });
  const paste = (files) => { const e = new Event("paste", { bubbles: true, cancelable: true }); e.clipboardData = { files }; zone.dispatchEvent(e); return e; };
  assert.equal(paste([file("shot.png", "image/png")]).defaultPrevented, true);
  assert.equal(paste([]).defaultPrevented, false, "text paste goes on");
  off = true; paste([file("x.png", "image/png")]);
  const e = drag("dragenter"); zone.dispatchEvent(e); assert.equal(e.defaultPrevented, false);
  assert.deepEqual(got, ["shot.png"]);
});
