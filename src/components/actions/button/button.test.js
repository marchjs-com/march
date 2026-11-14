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
  for (const c of ["m-btn", "m-btn-primary", "m-btn-sm", "m-btn-block"]) assert.ok(b.className.includes(c), c);
  assert.equal(b.getAttribute("type"), "button");
  b.click();
  assert.equal(n, 1);
  busy.set(true);
  assert.equal(b.disabled, true);
  assert.equal(b.getAttribute("aria-busy"), "true");
  assert.ok(b.querySelector(".m-btn-spin"));
  assert.equal(buttonSizeClass("lg"), "m-btn-lg");
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
  assert.equal(a.querySelector(".m-btn-spin"), null);
  assert.equal(a.querySelector(".m-icon").textContent, "+", "the icon stays");
  assert.equal(a.disabled, true, "still locked");
  assert.equal(b.querySelector(".m-btn-spin"), null);
  assert.equal(b.querySelector(".m-btn-spin-own").textContent, "~");
  assert.ok(c.querySelector(".m-btn-spin") && !c.querySelector(".m-icon"));
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

test("Button: link variant, pill shape, pressed toggle", () => {
  const on = signal(false);
  const m = mount(() => [
    h(Button, { variant: "link", pressed: on }, "More"),
    h(Button, { shape: "pill" }, "New"),
    h(Button, { "aria-pressed": "true" }, "Own"),
  ]);
  const [a, b, c] = m.el.querySelectorAll("button");
  assert.ok(a.className.includes("m-btn-link"));
  assert.equal(a.getAttribute("aria-pressed"), "false");
  assert.ok(!a.className.includes("is-pressed"));
  on.set(true);
  assert.equal(a.getAttribute("aria-pressed"), "true");
  assert.ok(a.className.includes("is-pressed"));
  assert.ok(b.className.includes("m-btn-pill"));
  assert.equal(b.hasAttribute("aria-pressed"), false, "a plain button has no pressed state");
  assert.equal(b.hasAttribute("shape"), false);
  assert.equal(c.getAttribute("aria-pressed"), "true", "the caller's own aria-pressed stays");
  m.dispose();
});

test("ActionButton: a plain { label, run }, its own run, extra attributes", async () => {
  const calls = [];
  const busy = signal(false);
  const plain = { label: () => "Archive", run: (row) => { calls.push(["run", row]); }, visible: (row) => row.id !== 2, disabled: (row) => row.locked === true, busy, opts: { danger: true } };
  let clicked = 0, done = 0;
  const m = mount(() => [
    h(ActionButton, { action: plain, args: [{ id: 1 }], role: "menuitem", class: "x-act", onClick: () => clicked++, onDone: () => done++ }),
    h(ActionButton, { action: plain, args: [{ id: 2 }] }),
    h(ActionButton, { action: plain, args: () => [{ id: 3, locked: true }] }),
    h(ActionButton, { action: plain, args: [{ id: 4 }], variant: "ghost", run: (row) => { calls.push(["own", row.id]); } }),
  ]);
  const btns = m.el.querySelectorAll("button");
  assert.equal(btns.length, 3, "the hidden one is not drawn");
  assert.equal(btns[0].textContent, "Archive");
  assert.equal(btns[0].getAttribute("role"), "menuitem");
  for (const c of ["m-btn-danger", "x-act"]) assert.ok(btns[0].className.includes(c), c);
  assert.equal(btns[1].disabled, true);
  btns[0].click(); btns[2].click();
  await tick();
  assert.deepEqual(calls, [["run", { id: 1 }], ["own", 4]]);
  assert.equal(clicked, 1);
  assert.equal(done, 1);
  busy.set(true);
  assert.equal(btns[0].getAttribute("aria-busy"), "true");
  m.dispose();
});

test("Button: href uses the router's Link inside the app, a plain link for an external address", async () => {
  const { provideLink } = await import("../../../dom/link.ts");
  const seen = [];
  provideLink((p) => { seen.push(p.href()); return h("a", { "data-router": "", href: p.href, class: p.class }, p.children); });
  const m = mount(() => [h(Button, { href: "/docs" }, "Docs"), h(Button, { href: "https://example.com/x" }, "Out"), h(Button, { href: "mailto:a@example.com" }, "Mail")]);
  const [a, b, c] = m.el.querySelectorAll("a");
  assert.deepEqual(seen, ["/docs"]);
  assert.ok(a.hasAttribute("data-router") && a.className.includes("m-btn"));
  assert.equal(b.hasAttribute("data-router"), false);
  assert.equal(b.getAttribute("href"), "https://example.com/x");
  assert.equal(c.hasAttribute("data-router"), false);
  provideLink(null);
  m.dispose();
});
