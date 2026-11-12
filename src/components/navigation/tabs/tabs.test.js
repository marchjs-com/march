import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const host = document.createElement("div"); document.body.appendChild(host); const dispose = render(fn, host); return { host, dispose }; };
const { Tabs, Tab } = await import("./index.ts");

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
