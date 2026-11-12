import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { ErrorBox } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };

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
