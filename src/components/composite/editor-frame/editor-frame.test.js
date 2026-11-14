import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { mProps } = await import("../../../props/index.ts");
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { EditorFrame } = await import("./index.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("EditorFrame: head, area and foot in order; bars are left out when they have nothing", () => {
  const [el, dispose] = mount(() => [
    h(EditorFrame, { head: h("b", null, "tools"), actions: h("i", null, "tabs"), foot: "12 words", "data-k": "1" }, h("textarea", { class: "m-editor-area" })),
    h(EditorFrame, { class: "bare" }, h("p", null, "body")),
  ]);
  const [full, bare] = el.querySelectorAll(".m-editor-frame");
  assert.deepEqual([...full.children].map((c) => c.tagName.toLowerCase()), ["div", "textarea", "footer"]);
  const head = full.querySelector(".m-editor-head");
  assert.ok(head.classList.contains("m-panel-header-muted") && head.classList.contains("is-divided") && head.classList.contains("m-panel-header-sm"));
  assert.equal(head.querySelector(".m-panel-header-body").textContent, "tools");
  assert.equal(head.querySelector(".m-panel-header-actions").textContent, "tabs");
  assert.equal(full.querySelector(".m-editor-foot").textContent, "12 words");
  assert.equal(full.getAttribute("data-k"), "1");
  assert.equal(bare.querySelector(".m-editor-head, .m-editor-foot"), null);
  assert.ok(bare.classList.contains("bare"));
  dispose();
});

test("EditorFrame: showHead / showFoot, bar props, states, ring, colour", () => {
  const show = signal(true), off = signal(false), color = signal("brand-green");
  const [el, dispose] = mount(() => mProps(h(EditorFrame, {
    head: "tools", showHead: show, headProps: { sticky: true, class: "my-head" }, foot: "count", showFoot: () => !off(), footProps: { divider: true, "aria-live": "off" },
    disabled: off, readonly: true, ring: false,
  }, "body"), { color }));
  const frame = el.querySelector(".m-editor-frame");
  assert.ok(frame.querySelector(".m-editor-head.my-head.is-sticky"));
  assert.ok(frame.querySelector(".m-editor-foot.is-divided"));
  assert.equal(frame.querySelector(".m-editor-foot").getAttribute("aria-live"), "off");
  assert.ok(frame.classList.contains("is-readonly") && frame.classList.contains("is-plain") && !frame.classList.contains("is-disabled"));
  assert.equal(frame.getAttribute("data-m-color"), "brand-green");
  show.set(false); off.set(true); color.set(undefined);
  assert.equal(frame.querySelector(".m-editor-head, .m-editor-foot"), null);
  assert.ok(frame.classList.contains("is-disabled"));
  assert.equal(frame.getAttribute("data-m-color"), null);
  dispose();
});
