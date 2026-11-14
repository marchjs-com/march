import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { ErrorBox } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };
const mountD = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("ErrorBox: an Error's message, role alert, retry runs; a default message", () => {
  let n = 0;
  const el = mount(() => [h(ErrorBox, { title: "Could not load", error: new Error("503"), retry: () => n++ }), h(ErrorBox, {})]);
  const [a, b] = el.querySelectorAll(".hm-errorbox");
  assert.equal(a.getAttribute("role"), "alert");
  assert.equal(a.querySelector(".hm-errorbox-title").textContent, "Could not load");
  assert.equal(a.querySelector("p").textContent, "503");
  a.querySelector("button").click();
  assert.equal(n, 1);
  assert.equal(b.querySelector("p").textContent, "Something went wrong.");
  assert.equal(b.querySelector("button"), null);
});

test("ErrorBox: own retry label (text or node) and message", () => {
  const m = mountD(() => [h(ErrorBox, { message: "Offline", retry: () => {}, retryLabel: "Reconnect" }), h(ErrorBox, { retry: () => {}, retryLabel: h("b", { class: "mine" }, "Again") })]);
  const [a, b] = m.el.querySelectorAll(".hm-errorbox");
  assert.equal(a.querySelector(".hm-errorbox-text").textContent, "Offline");
  assert.equal(a.querySelector(".hm-errorbox-retry").textContent, "Reconnect");
  assert.equal(b.querySelector(".hm-errorbox-retry .mine").textContent, "Again");
  m.dispose();
});
