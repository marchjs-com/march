import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { PanelHeader } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));

test("PanelHeader: icon, title, subtitle, meta, actions and close", () => {
  const title = signal("Settings");
  let closed = 0;
  const m = mount(() => h(PanelHeader, { icon: "⚙", title, subtitle: "Workspace", meta: 3, titleId: "t1", actions: h("button", { class: "act" }, "Save"), onClose: () => closed++, divider: true, size: "sm" }));
  const root = m.el.querySelector("header.hm-panel-header.hm-panel-header-sm.is-divided");
  assert.ok(root);
  assert.equal(root.querySelector("h3.hm-panel-header-title").id, "t1");
  assert.equal(root.querySelector(".hm-panel-header-title").textContent, "Settings");
  title.set("Profile");
  assert.equal(root.querySelector(".hm-panel-header-title").textContent, "Profile");
  assert.equal(root.querySelector(".hm-panel-header-sub").textContent, "Workspace");
  assert.equal(root.querySelector(".hm-panel-header-meta").textContent, "3");
  assert.equal(root.querySelector(".hm-panel-header-icon").getAttribute("aria-hidden"), "true");
  assert.ok(root.querySelector(".hm-panel-header-actions .act"));
  const close = root.querySelector("button.hm-panel-header-close");
  assert.equal(close.getAttribute("aria-label"), "Close");
  close.click();
  assert.equal(closed, 1);
  m.dispose();
});

test("PanelHeader: parts are optional; close off, own close icon and label", () => {
  const m = mount(() => [
    h(PanelHeader, { title: "Plain", onClose: () => {}, close: false }),
    h(PanelHeader, { title: "Own", onClose: () => {}, close: h("i", { class: "mine" }), closeLabel: "Dismiss", titleAs: "span" }),
  ]);
  const [a, b] = m.el.querySelectorAll(".hm-panel-header");
  assert.equal(a.querySelector(".hm-panel-header-close"), null);
  assert.equal(a.querySelector(".hm-panel-header-icon"), null);
  assert.equal(a.querySelector(".hm-panel-header-actions"), null);
  assert.ok(b.querySelector(".hm-panel-header-close .mine"));
  assert.equal(b.querySelector(".hm-panel-header-close").getAttribute("aria-label"), "Dismiss");
  assert.equal(b.querySelector(".hm-panel-header-title").tagName, "SPAN");
  m.dispose();
});

test("PanelHeader: drag handle (ref and events on the root, close is not a drag), footer, sticky, tone, color, class", () => {
  let got = null, downs = 0;
  const m = mount(() => [
    h(PanelHeader, { title: "Window", drag: true, ref: (el) => { got = el; }, onPointerDown: () => downs++, onClose: () => {}, role: "toolbar", tabindex: "0", sticky: true, tone: "muted", color: "brand-orange", class: "mine" }),
    h(PanelHeader, { as: "footer", title: "3 changes", actions: h("button", {}, "Save"), divider: true }),
  ]);
  const [bar, foot] = m.el.querySelectorAll(".hm-panel-header");
  assert.equal(got, bar);
  for (const c of ["is-drag", "is-sticky", "hm-panel-header-muted", "mine"]) assert.ok(bar.classList.contains(c), c);
  assert.equal(bar.getAttribute("role"), "toolbar");
  assert.equal(bar.getAttribute("tabindex"), "0");
  assert.equal(bar.getAttribute("data-hm-color"), "brand-orange");
  fire(bar.querySelector(".hm-panel-header-title"), "pointerdown");
  assert.equal(downs, 1);
  fire(bar.querySelector(".hm-panel-header-close"), "pointerdown");
  assert.equal(downs, 1, "a press on the close button is not a drag");
  assert.equal(foot.tagName, "FOOTER");
  assert.ok(foot.classList.contains("hm-panel-header-foot") && foot.classList.contains("is-divided"));
  assert.equal(foot.querySelector(".hm-panel-header-title").tagName, "SPAN");
  m.dispose();
});

test("PanelHeader: partClass adds a host's own class to a part", () => {
  const { el, dispose } = mount(() => h(PanelHeader, { title: "T", subtitle: "S", meta: "3", actions: "a", partClass: { title: "my-title", subtitle: "my-sub", meta: "my-meta", actions: "my-actions", titles: "my-titles" } }));
  assert.equal(el.querySelector(".hm-panel-header-title.my-title").textContent, "T");
  assert.ok(el.querySelector(".hm-panel-header-sub.my-sub") && el.querySelector(".hm-panel-header-meta.my-meta") && el.querySelector(".hm-panel-header-actions.my-actions") && el.querySelector(".hm-panel-header-titles.my-titles"));
  assert.equal(el.querySelector(".hm-panel-header").hasAttribute("partClass"), false);
  dispose();
});
