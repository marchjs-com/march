import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../index.ts");
const { PullToRefresh } = await import("./index.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const ev = (type, x, y, t = 0) => { const e = new globalThis.Event(type, { bubbles: true, cancelable: true }); Object.assign(e, { clientX: x, clientY: y, button: 0, pointerId: 1, timeStamp: t }); return e; };

test("PullToRefresh: pull past the threshold runs the async refresh, spins, then settles", async () => {
  const phases = [];
  let resolve, calls = 0;
  const m = mount(() => h(PullToRefresh, { threshold: 40, onPhase: (p) => phases.push(p), onRefresh: () => { calls++; return new Promise((r) => { resolve = r; }); } }, h("p", null, "feed")));
  const root = m.el.querySelector(".hm-ptr");
  const item = root.querySelector("p");
  item.dispatchEvent(ev("pointerdown", 10, 0));
  item.dispatchEvent(ev("pointermove", 10, 30));
  assert.ok(root.classList.contains("is-pulling"));
  item.dispatchEvent(ev("pointermove", 10, 140));
  assert.equal(phases.at(-1), "ready");
  assert.equal(root.querySelector("[role=status]").textContent, "Release to refresh");
  item.dispatchEvent(ev("pointerup", 10, 140));
  assert.equal(calls, 1);
  assert.equal(root.getAttribute("aria-busy"), "true");
  assert.equal(root.querySelector("[role=status]").textContent, "Refreshing…");
  resolve();
  await tick(); await tick();
  assert.equal(phases.at(-1), "idle");
  assert.equal(root.getAttribute("aria-busy"), null);
  m.dispose();
});

test("PullToRefresh: a short pull springs back without refreshing; the click after a pull is swallowed", async () => {
  let calls = 0, clicks = 0;
  const m = mount(() => h(PullToRefresh, { threshold: 80, onRefresh: () => { calls++; } }, h("button", { onClick: () => clicks++ }, "row")));
  const root = m.el.querySelector(".hm-ptr");
  const row = root.querySelector(".hm-ptr-content button");
  row.dispatchEvent(ev("pointerdown", 10, 0));
  row.dispatchEvent(ev("pointermove", 10, 40));
  row.dispatchEvent(ev("pointerup", 10, 40));
  row.click();
  assert.equal(calls, 0);
  assert.equal(clicks, 0);
  row.click();
  assert.equal(clicks, 1);
  m.dispose();
});

test("PullToRefresh: keyboard button refreshes; disabled ignores pulls", async () => {
  let calls = 0;
  const m = mount(() => [h(PullToRefresh, { onRefresh: () => { calls++; } }, "a"), h(PullToRefresh, { disabled: true, onRefresh: () => { calls++; } }, "b")]);
  const [a, b] = m.el.querySelectorAll(".hm-ptr");
  const kbd = a.querySelector(".hm-ptr-kbd");
  assert.equal(kbd.textContent, "Refresh");
  kbd.click();
  assert.equal(calls, 1);
  await tick(); await tick();
  b.dispatchEvent(ev("pointerdown", 0, 0));
  b.dispatchEvent(ev("pointermove", 0, 300));
  b.dispatchEvent(ev("pointerup", 0, 300));
  assert.equal(calls, 1);
  assert.ok(b.querySelector(".hm-ptr-kbd").disabled);
  m.dispose();
});
