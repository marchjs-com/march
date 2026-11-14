import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { mProps } = await import("../../../props/index.ts");
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const host = document.createElement("div"); document.body.appendChild(host); const dispose = render(fn, host); return { host, dispose }; };
const { Tabs, Tab, TabList } = await import("./index.ts");

test("Tabs: controlled value, click and arrow keys switch, only the active panel exists", () => {
  const cur = signal("a");
  const { host, dispose } = mount(() => h(Tabs, { value: cur, onChange: (id) => cur.set(id), label: "T", tabs: [
    { id: "a", label: "A", content: () => "one" }, { id: "b", label: "B", badge: 2, content: () => "two" }, { id: "c", label: "C", disabled: true, content: "three" },
  ] }));
  const tabs = host.querySelectorAll('[role="tab"]');
  assert.equal(tabs.length, 3);
  assert.equal(host.querySelector('[role="tablist"]').getAttribute("aria-label"), "T");
  assert.equal(tabs[0].getAttribute("aria-selected"), "true");
  assert.equal(tabs[0].getAttribute("tabindex"), "0");
  assert.equal(tabs[1].getAttribute("tabindex"), "-1");
  assert.match(host.querySelector('[role="tabpanel"]').textContent, /one/);
  tabs[1].click();
  assert.equal(cur(), "b");
  assert.equal(host.querySelectorAll('[role="tabpanel"]').length, 1);
  assert.match(host.querySelector('[role="tabpanel"]').textContent, /two/);
  assert.equal(tabs[2].disabled, true);
  dispose();
});

test("Tabs: <Tab> children and panel={false}", () => {
  const { host, dispose } = mount(() => h(Tabs, { panel: false }, h(Tab, { id: "x", label: "X" }, "body"), h(Tab, { id: "y", label: "Y" }, "other")));
  assert.equal(host.querySelectorAll('[role="tab"]').length, 2);
  assert.equal(host.querySelector('[role="tabpanel"]'), null);
  dispose();
});

test("Tabs: indicator off, motion none, own motion gets the panel and the direction", () => {
  const cur = signal("a"), calls = [];
  const tabs = [{ id: "a", label: "A", content: "one" }, { id: "b", label: "B", content: "two" }];
  const { host, dispose } = mount(() => [
    h(Tabs, { tabs, indicator: false, motion: "none" }),
    h(Tabs, { tabs, value: cur, motion: (panel, dir) => calls.push([panel.getAttribute("role"), dir]) }),
    h(Tabs, { tabs }),
  ]);
  const [plain, own, std] = host.querySelectorAll(".m-tabs");
  assert.match(plain.getAttribute("class"), /m-tabs-plain/);
  assert.match(plain.getAttribute("class"), /m-tabs-still/);
  assert.doesNotMatch(std.getAttribute("class"), /m-tabs-plain|m-tabs-still/);
  assert.deepEqual(calls, [], "no motion for the first panel");
  cur.set("b");
  cur.set("a");
  assert.deepEqual(calls, [["tabpanel", 1], ["tabpanel", -1]]);
  assert.match(own.querySelector('[role="tabpanel"]').textContent, /one/);
  dispose();
});

test("Tabs: icon, dirty dot, closable (mark and Delete key), actions slot, pill variant, tabProps", () => {
  const closed = [], downs = [];
  const dirty = signal(false);
  const { host, dispose } = mount(() => h(Tabs, {
    variant: "pill", onClose: (id) => closed.push(id), labels: { close: "Shut", dirty: "Changed" }, actions: h("button", { class: "act" }, "+"),
    tabProps: (tab) => ({ class: "own", "data-kind": "doc", onPointerdown: () => downs.push(tab.id) }),
    tabs: [{ id: "a", label: "A", icon: "★", closable: true, dirty, title: "First", content: "one" }, { id: "b", label: "B", closable: false, content: "two" }],
  }));
  const [a, b] = host.querySelectorAll('[role="tab"]');
  assert.match(host.querySelector('[role="tablist"]').getAttribute("class"), /m-tabs-bar-pill/);
  assert.equal(a.querySelector(".m-tab-icon").textContent, "★");
  assert.equal(a.getAttribute("title"), "First");
  assert.match(a.getAttribute("class"), /m-tab\b.*own/);
  assert.equal(a.getAttribute("data-kind"), "doc");
  assert.equal(a.querySelector(".m-tab-dirty"), null);
  dirty.set(true);
  assert.equal(a.querySelector(".m-tab-dirty").getAttribute("aria-label"), "Changed");
  const x = a.querySelector(".m-tab-close");
  assert.equal(x.getAttribute("title"), "Shut");
  assert.equal(x.getAttribute("aria-hidden"), "true");
  assert.equal(a.getAttribute("aria-keyshortcuts"), "Delete");
  assert.equal(b.querySelector(".m-tab-close"), null);
  b.click();
  x.click();
  assert.deepEqual(closed, ["a"]);
  assert.equal(b.getAttribute("aria-selected"), "true", "the close mark does not select its tab");
  const key = (el, k) => { const e = new Event("keydown", { bubbles: true, cancelable: true }); e.key = k; el.dispatchEvent(e); };
  key(a, "Delete");
  key(b, "Delete");
  assert.deepEqual(closed, ["a", "a"], "Delete closes a closable tab only");
  a.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  assert.deepEqual(downs, ["a"]);
  const head = host.querySelector(".m-tabs-head");
  assert.ok(head.querySelector(".m-tabs-actions .act"));
  assert.equal(host.querySelector('[role="tablist"] .act'), null, "actions stay outside the tab list");
  dispose();
});

test("TabList: the strip alone, vertical, manual activation, wrap, no look", () => {
  const cur = signal(null), picked = [];
  const { host, dispose } = mount(() => h(TabList, {
    tabs: [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C", hidden: true }], value: cur, onSelect: (id) => { picked.push(id); cur.set(id); },
    orientation: "vertical", activation: "manual", variant: "none", label: "Views", controls: "side", tabId: (id) => `v-${id}`,
    tabProps: () => ({ class: "my-tab" }), wrap: (btn) => h("span", { class: "wrap" }, btn),
  }));
  const bar = host.querySelector('[role="tablist"]');
  assert.equal(bar.getAttribute("aria-orientation"), "vertical");
  assert.equal(bar.getAttribute("aria-label"), "Views");
  assert.doesNotMatch(bar.getAttribute("class") ?? "", /m-tabs-bar/);
  const [a, b] = host.querySelectorAll('[role="tab"]');
  assert.equal(host.querySelectorAll('[role="tab"]').length, 2);
  assert.equal(a.id, "v-a");
  assert.equal(a.getAttribute("aria-controls"), "side");
  assert.equal(a.getAttribute("class"), "my-tab");
  assert.equal(a.parentNode.getAttribute("class"), "wrap");
  assert.equal(a.getAttribute("tabindex"), "0", "no active tab: the first one is the Tab stop");
  a.focus();
  const down = new Event("keydown", { bubbles: true, cancelable: true }); down.key = "ArrowDown"; a.dispatchEvent(down);
  assert.equal(document.activeElement, b);
  assert.deepEqual(picked, [], "manual activation: arrows only move focus");
  b.click();
  assert.deepEqual(picked, ["b"]);
  assert.equal(b.getAttribute("aria-selected"), "true");
  assert.equal(b.getAttribute("tabindex"), "0");
  assert.equal(a.getAttribute("tabindex"), "-1");
  dispose();
});

test("Tabs: color, label and variant stay live", () => {
  const variant = signal("line"), label = signal("One");
  const { host, dispose } = mount(() => mProps(h(Tabs, { variant, label, tabs: [{ id: "a", label: "A" }] }), { color: "brand-blue" }));
  const bar = host.querySelector('[role="tablist"]');
  assert.equal(bar.closest("[data-m-color]")?.getAttribute("data-m-color"), "brand-blue");
  assert.equal(bar.getAttribute("aria-label"), "One");
  variant.set("pill"); label.set("Two");
  assert.match(bar.getAttribute("class"), /m-tabs-bar-pill/);
  assert.equal(bar.getAttribute("aria-label"), "Two");
  dispose();
});
