import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const host = document.createElement("div"); document.body.appendChild(host); const dispose = render(fn, host); return { host, dispose }; };
const { NavMenu } = await import("./index.ts");

test("NavMenu: a labelled nav with grouped links and a filter box; filter={false} drops it", () => {
  const items = [{ id: "a", title: "Alpha", href: "/a" }, { id: "b", title: "Beta", href: "/b", group: "G" }];
  const { host, dispose } = mount(() => h(NavMenu, { items, palette: false, storageKey: "t.nav", label: "Main" }));
  assert.ok(host.querySelector(".hm-nav"));
  assert.ok(host.querySelector(".hm-nav-filter input"));
  assert.match(host.textContent, /Alpha/);
  assert.match(host.textContent, /Beta/);
  assert.ok(host.querySelector(".hm-nav-group"));
  dispose();
  const b = mount(() => h(NavMenu, { items, palette: false, storageKey: "t.nav2", filter: false }));
  assert.equal(b.host.querySelector(".hm-nav-filter"), null);
  b.dispose();
});
