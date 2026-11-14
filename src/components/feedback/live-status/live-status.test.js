import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { LiveStatus } = await import("./index.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("LiveStatus: a polite status with live text; element, politeness, class and attributes are yours", () => {
  const n = signal(2);
  const [el, dispose] = mount(() => [
    h(LiveStatus, { text: () => `${n()} selected`, class: "mine", "data-id": "count" }),
    h(LiveStatus, { as: "p", politeness: "assertive" }, "Failed"),
  ]);
  const [a, b] = el.querySelectorAll(".m-live-status");
  assert.equal(a.tagName, "SPAN");
  assert.equal(a.getAttribute("role"), "status");
  assert.equal(a.getAttribute("aria-live"), "polite");
  assert.equal(a.textContent, "2 selected");
  n.set(3);
  assert.equal(a.textContent, "3 selected");
  assert.ok(a.classList.contains("mine") && !a.classList.contains("m-sr-only"));
  assert.equal(a.getAttribute("data-id"), "count");
  assert.equal(a.hasAttribute("text") || a.hasAttribute("visible"), false);
  assert.equal(b.tagName, "P");
  assert.equal(b.getAttribute("aria-live"), "assertive");
  assert.equal(b.textContent, "Failed");
  assert.equal(el.querySelector(".m-live-status-help"), null);
  dispose();
});

test("LiveStatus: visible={false} is only read; help adds a hint line with an id and your class", () => {
  const said = signal(""), hint = signal("Drag to move");
  const [el, dispose] = mount(() => [
    h(LiveStatus, { visible: false, text: said, help: hint, helpId: "x-help", helpClass: "my-help" }),
    h(LiveStatus, { visible: false, text: said, help: false }),
    h(LiveStatus, { text: "x", help: h("b", { class: "own" }, "own hint") }),
  ]);
  const helps = el.querySelectorAll(".m-live-status-help");
  assert.equal(helps.length, 2);
  assert.equal(helps[0].tagName, "P");
  assert.equal(helps[0].id, "x-help");
  assert.ok(helps[0].classList.contains("my-help"));
  assert.equal(helps[0].textContent, "Drag to move");
  hint.set("Read only");
  assert.equal(helps[0].textContent, "Read only");
  assert.ok(helps[1].querySelector(".own"));
  const status = el.querySelector(".m-live-status");
  assert.ok(status.classList.contains("m-sr-only"));
  assert.equal(helps[0].nextElementSibling, status, "the hint comes first");
  said.set("Build: 9 Nov – 13 Nov");
  assert.equal(status.textContent, "Build: 9 Nov – 13 Nov");
  dispose();
});
