import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const tick = () => new Promise((r) => setTimeout(r, 0));
const { Button, ActionButton, buttonSizeClass } = await import("./index.ts");
const { action } = await import("../../../ui/action.ts");

test("Button: variant, size, loading locks it, block", () => {
  const busy = signal(false);
  let n = 0;
  const m = mount(() => h(Button, { variant: "primary", size: "sm", loading: busy, block: true, onClick: () => n++ }, "Save"));
  const b = m.el.querySelector("button");
  for (const c of ["hm-btn", "hm-btn-primary", "hm-btn-sm", "hm-btn-block"]) assert.ok(b.className.includes(c), c);
  assert.equal(b.getAttribute("type"), "button");
  b.click();
  assert.equal(n, 1);
  busy.set(true);
  assert.equal(b.disabled, true);
  assert.equal(b.getAttribute("aria-busy"), "true");
  assert.ok(b.querySelector(".hm-btn-spin"));
  assert.equal(buttonSizeClass("lg"), "hm-btn-lg");
  assert.equal(buttonSizeClass("md"), undefined);
  m.dispose();
});

test("Button: the spinner can be turned off or replaced", () => {
  const m = mount(() => [
    h(Button, { loading: true, spinner: false, icon: "+" }, "A"),
    h(Button, { loading: true, spinner: "~" }, "B"),
    h(Button, { loading: true, icon: "+" }, "C"),
  ]);
  const [a, b, c] = m.el.querySelectorAll("button");
  assert.equal(a.querySelector(".hm-btn-spin"), null);
  assert.equal(a.querySelector(".hm-icon").textContent, "+", "the icon stays");
  assert.equal(a.disabled, true, "still locked");
  assert.equal(b.querySelector(".hm-btn-spin"), null);
  assert.equal(b.querySelector(".hm-btn-spin-own").textContent, "~");
  assert.ok(c.querySelector(".hm-btn-spin") && !c.querySelector(".hm-icon"));
  assert.equal(a.hasAttribute("spinner"), false);
  m.dispose();
});

test("ActionButton: hidden when not allowed, runs the action", async () => {
  let ran = 0;
  const ok = action("Run", async () => { ran++; });
  const no = action("Hidden", async () => {}, { can: () => false });
  const m = mount(() => [h(ActionButton, { action: ok }), h(ActionButton, { action: no })]);
  const btns = m.el.querySelectorAll("button");
  assert.equal(btns.length, 1);
  assert.equal(btns[0].textContent, "Run");
  btns[0].click();
  await tick();
  assert.equal(ran, 1);
  m.dispose();
});
