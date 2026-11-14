import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Overlay, quietMedia } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };
const mountD = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("Overlay: an effect layer is decorative and inert; front and physical sides set their variables", async () => {
  const el = mount(() => h("div", null, h(Overlay, { effect: "mesh" }), h(Overlay, { effect: "glass", front: true, left: 2 })));
  const [a, b] = el.querySelectorAll(".hm-ov");
  assert.ok(a.classList.contains("hm-ov-fx-mesh"));
  assert.equal(a.getAttribute("aria-hidden"), "true");
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(a.parentElement.classList.contains("hm-ov-host"));
  assert.ok(b.classList.contains("hm-ov-front"));
  assert.ok(b.classList.contains("hm-ov-physical"));
  assert.match(b.style.getPropertyValue("--hm-ov-left"), /--hm-space-2/);
  assert.equal(typeof quietMedia(), "boolean");
});

test("Overlay: a live front / opacity prop restacks and refades the layer", async () => {
  const { signal, reactive } = await import("../../../index.ts");
  const front = signal(false), opacity = signal(1);
  const el = mount(() => h("div", null, h(Overlay, { effect: "mesh", front: reactive(() => front()), opacity })));
  const o = el.querySelector(".hm-ov");
  assert.ok(Number(o.style.getPropertyValue("--hm-ov-z")) < 0);
  front.set(true); opacity.set(0.4);
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(Number(o.style.getPropertyValue("--hm-ov-z")) > 0);
  assert.equal(o.style.getPropertyValue("--hm-ov-opacity"), "0.4");
});

test("Overlay: a colour token and an own class", () => {
  const m = mountD(() => h("div", null, h(Overlay, { effect: "spotlight", color: "brand-orange", class: "mine" }), h(Overlay, { effect: "dots" })));
  const [a, b] = m.el.querySelectorAll(".hm-ov");
  assert.equal(a.getAttribute("data-hm-color"), "brand-orange");
  assert.ok(a.classList.contains("mine") && a.classList.contains("hm-ov-fx-spotlight"));
  assert.equal(b.getAttribute("data-hm-color"), null);
  m.dispose();
});
