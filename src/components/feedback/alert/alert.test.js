import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Alert, Notice } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };

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
