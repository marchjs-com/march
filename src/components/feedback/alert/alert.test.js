import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Alert, Notice } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };
const mountD = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("Alert: tone class and role; danger and warn are alerts, the others status", () => {
  const el = mount(() => [h(Alert, { tone: "danger", title: "Failed" }, "Card declined"), h(Alert, { tone: "success" }, "Saved")]);
  const [a, b] = el.querySelectorAll(".hm-alert");
  assert.ok(a.classList.contains("hm-alert-danger"));
  assert.equal(a.getAttribute("role"), "alert");
  assert.equal(a.querySelector(".hm-alert-title").textContent, "Failed");
  assert.equal(b.getAttribute("role"), "status");
});

test("Alert: dismiss hides it and calls onDismiss; Notice is Alert", () => {
  let n = 0;
  const el = mount(() => h(Alert, { dismissable: true, onDismiss: () => n++ }, "Heads up"));
  el.querySelector(".hm-alert-x").click();
  assert.equal(n, 1);
  assert.equal(el.querySelector(".hm-alert"), null);
  assert.equal(Notice, Alert);
});

test("Alert: own dismiss label and icon, a colour token, no icon", () => {
  const m = mountD(() => h(Alert, { dismissable: true, dismissLabel: "Close it", dismissIcon: h("i", { class: "mine" }), color: "brand-purple", icon: null }, "Hi"));
  const a = m.el.querySelector(".hm-alert");
  assert.equal(a.getAttribute("data-hm-color"), "brand-purple");
  assert.equal(a.querySelector(".hm-alert-icon"), null);
  const x = a.querySelector(".hm-alert-x");
  assert.equal(x.getAttribute("aria-label"), "Close it");
  assert.ok(x.querySelector(".mine"));
  assert.equal(x.querySelector("svg"), null);
  m.dispose();
});

test("Alert: action sits beside the text before the dismiss button, or below the text; action() objects become buttons", async () => {
  const { action } = await import("../../../ui/action.ts");
  let ran = 0;
  const retry = action("Retry", async () => { ran++; });
  const m = mountD(() => [
    h(Alert, { tone: "danger", dismissable: true, action: h("button", { class: "go" }, "Reload"), class: "a" }, "New version"),
    h(Alert, { actionPlacement: "below", action: [retry], class: "b" }, "Failed"),
    h(Alert, { class: "c" }, "Plain"),
  ]);
  const a = m.el.querySelector(".a"), b = m.el.querySelector(".b");
  const order = [...a.children].map((x) => x.className.split(" ").pop());
  assert.deepEqual(order.slice(-3), ["hm-alert-main", "hm-alert-action", "hm-alert-x"]);
  assert.equal(a.querySelector(".hm-alert-action .go").parentElement.parentElement, a);
  const below = b.querySelector(".hm-alert-main .hm-alert-action-below");
  assert.equal(below.querySelector("button").textContent, "Retry");
  below.querySelector("button").click();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(ran, 1);
  assert.equal(m.el.querySelector(".c .hm-alert-action"), null);
  m.dispose();
});
