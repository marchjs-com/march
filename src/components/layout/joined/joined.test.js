import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Joined } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("Joined: direction, radius, frame, dividers", () => {
  const dir = signal("vertical");
  const m = mount(() => h(Joined, { direction: dir, radius: "full", role: "group", "aria-label": "Ara" }, h("p", null, "a"), h("p", null, "b")));
  const j = m.el.querySelector(".m-joined");
  assert.ok(j.classList.contains("m-joined-lines") && j.classList.contains("m-joined-rf"));
  assert.ok(!j.classList.contains("m-joined-h") && !j.classList.contains("m-joined-bare"));
  assert.equal(j.getAttribute("role"), "group");
  assert.equal(j.hasAttribute("direction"), false);
  assert.equal(j.children.length, 2);
  dir.set("horizontal");
  assert.ok(j.classList.contains("m-joined-h"));
  m.dispose();
  const n = mount(() => h(Joined, { border: false, dividers: false, radius: 0 }, "x"));
  const k = n.el.querySelector(".m-joined");
  assert.ok(k.classList.contains("m-joined-bare") && k.classList.contains("m-joined-r0") && !k.classList.contains("m-joined-lines"));
  n.dispose();
});
