import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Empty } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };

test("Empty: title, text and actions; a default title when none is given", () => {
  const el = mount(() => [h(Empty, { title: "No users", action: [h("button", null, "Invite")] }, "Invite someone"), h(Empty, {})]);
  const [a, b] = el.querySelectorAll(".hm-empty");
  assert.equal(a.querySelector(".hm-empty-title").textContent, "No users");
  assert.equal(a.querySelector(".hm-empty-text").textContent, "Invite someone");
  assert.equal(a.querySelector(".hm-empty-action button").textContent, "Invite");
  assert.equal(b.querySelector(".hm-empty-title").textContent, "Nothing here yet");
  assert.equal(b.querySelector(".hm-empty-action"), null);
});
