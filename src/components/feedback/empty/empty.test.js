import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Empty } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };
const mountD = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("Empty: title, text and actions; a default title when none is given", () => {
  const el = mount(() => [h(Empty, { title: "No users", action: [h("button", null, "Invite")] }, "Invite someone"), h(Empty, {})]);
  const [a, b] = el.querySelectorAll(".m-empty");
  assert.equal(a.querySelector(".m-empty-title").textContent, "No users");
  assert.equal(a.querySelector(".m-empty-text").textContent, "Invite someone");
  assert.equal(a.querySelector(".m-empty-action button").textContent, "Invite");
  assert.equal(b.querySelector(".m-empty-title").textContent, "Nothing here yet");
  assert.equal(b.querySelector(".m-empty-action"), null);
});

test("Empty: title={false} leaves the title out", () => {
  const m = mountD(() => h(Empty, { title: false, class: "mine" }, "Only text"));
  const e = m.el.querySelector(".m-empty.mine");
  assert.equal(e.querySelector(".m-empty-title"), null);
  assert.equal(e.querySelector(".m-empty-text").textContent, "Only text");
  m.dispose();
});

test("Empty: size=\"sm\" is the compact one; md stays as it was", () => {
  const el = mount(() => [h(Empty, { size: "sm", title: "No matches", class: "s" }), h(Empty, { class: "m" })]);
  assert.ok(el.querySelector(".s").classList.contains("m-empty-sm"));
  assert.equal(el.querySelector(".s .m-empty-title").textContent, "No matches");
  assert.ok(!el.querySelector(".m").classList.contains("m-empty-sm"));
});
