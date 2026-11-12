import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const host = document.createElement("div"); document.body.appendChild(host); const dispose = render(fn, host); return { host, dispose }; };
const { Accordion } = await import("./index.ts");

test("Accordion: one open at a time by default; multiple keeps several; disabled header", () => {
  const items = [{ title: "A", content: "a" }, { title: "B", content: "b" }, { title: "C", content: "c", disabled: true }];
  const { host, dispose } = mount(() => h(Accordion, { items, open: [0] }));
  const btns = host.querySelectorAll(".hm-acc-btn");
  assert.equal(btns[0].getAttribute("aria-expanded"), "true");
  assert.equal(host.querySelector(`#${btns[0].getAttribute("aria-controls")}`).getAttribute("role"), "region");
  btns[1].click();
  assert.equal(btns[0].getAttribute("aria-expanded"), "false");
  assert.equal(btns[1].getAttribute("aria-expanded"), "true");
  assert.equal(btns[2].disabled, true);
  dispose();
  const m = mount(() => h(Accordion, { items, multiple: true, variant: "contained" }));
  const mb = m.host.querySelectorAll(".hm-acc-btn");
  mb[0].click(); mb[1].click();
  assert.equal(mb[0].getAttribute("aria-expanded"), "true");
  assert.equal(mb[1].getAttribute("aria-expanded"), "true");
  assert.match(m.host.querySelector(".hm-accordion").getAttribute("class"), /hm-accordion-contained/);
  m.dispose();
});
