import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const tick = () => new Promise((r) => setTimeout(r, 0));
const { ButtonGroup } = await import("./index.ts");
const { Button } = await import("../button/index.ts");

test("ButtonGroup: labelled group, attached strip", () => {
  const m = mount(() => h(ButtonGroup, { attached: true, label: "Align" }, h(Button, {}, "A"), h(Button, {}, "B")));
  const g = m.el.querySelector(".hm-btn-group");
  assert.equal(g.getAttribute("role"), "group");
  assert.equal(g.getAttribute("aria-label"), "Align");
  assert.ok(g.className.includes("hm-btn-group-attached"));
  assert.equal(g.querySelectorAll("button").length, 2);
  m.dispose();
});
