import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { FileUpload } = await import("./index.ts");

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void tick; void type; void key; void signal;

test("FileUpload: accept and size checks, preview, progress through the Progress component, cancel", async () => {
  const v = signal(null);
  const m1 = mount(() => h(FileUpload, { "bind:value": v, maxSize: 1000, accept: "image/*" }));
  const zone = m1.el.querySelector(".hm-drop");
  assert.equal(zone.getAttribute("role"), "button");
  fire(zone, "drop", { dataTransfer: { files: [new File(["x".repeat(2000)], "big.png", { type: "image/png" })] } });
  assert.match(m1.el.querySelector(".hm-upload-errors[role=alert]").textContent, /big\.png is too large/);
  fire(zone, "drop", { dataTransfer: { files: [new File(["hi"], "a.txt", { type: "text/plain" })] } });
  assert.match(m1.el.textContent, /not allowed/);
  const ok = new File(["ok"], "ok.png", { type: "image/png" });
  fire(zone, "drop", { dataTransfer: { files: [ok] } });
  assert.equal(v(), ok);
  assert.ok(m1.el.querySelector("img.hm-file-thumb").getAttribute("src").startsWith("blob:"));

  const uploads = [];
  const upload = (file, { onProgress, signal: sig }) => new Promise((resolve, reject) => { uploads.push({ onProgress, resolve, sig }); sig.addEventListener("abort", () => reject(new Error("aborted"))); });
  const r = signal([]);
  const m2 = mount(() => h(FileUpload, { "bind:value": r, upload, multiple: true }));
  fire(m2.el.querySelector(".hm-drop"), "drop", { dataTransfer: { files: [new File(["1"], "one.pdf"), new File(["2"], "two.pdf")] } });
  await tick();
  uploads[0].onProgress(0.5);
  const bar = m2.el.querySelector(".hm-file-progress [role=progressbar]");
  assert.equal(bar.getAttribute("aria-valuenow"), "50");
  assert.equal(bar.getAttribute("aria-label"), "Uploading one.pdf");
  uploads[0].resolve({ url: "https://cdn/one.pdf" });
  await tick();
  assert.deepEqual(r(), [{ url: "https://cdn/one.pdf" }]);
  m2.el.querySelectorAll("button").find((b) => b.textContent === "Cancel").click();
  assert.equal(uploads[1].sig.aborted, true);
  m2.dispose();
});
