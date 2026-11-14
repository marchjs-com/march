import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Timeline } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("Timeline: ordered items, tones, text and machine-readable times", () => {
  const when = new Date(Date.UTC(2026, 0, 2, 3, 4));
  const m = mount(() => h(Timeline, { items: [{ time: "Today", title: "Placed", body: "#1", tone: "info" }, { time: when, title: "Paid", tone: "success" }, { title: "Shipped" }] }));
  const ol = m.el.querySelector("ol.m-timeline");
  const items = ol.querySelectorAll(".m-tl-item");
  assert.equal(items.length, 3);
  assert.ok(items[0].className.includes("m-tl-info"));
  assert.equal(items[0].querySelector("time").textContent, "Today");
  assert.equal(items[1].querySelector("time").getAttribute("datetime"), when.toISOString());
  assert.notEqual(items[1].querySelector("time").textContent, "", "dates are formatted");
  assert.equal(items[2].querySelector("time"), null);
  assert.equal(items[0].querySelector(".m-tl-body").textContent, "#1");
  m.dispose();
});

test("Timeline: colour token, own dot, no dot, no line, own time text", () => {
  const items = [{ time: 5, title: "A", color: "brand-purple", class: "is-mine" }, { title: "B" }];
  const m = mount(() => [h(Timeline, { items }), h(Timeline, { items, dot: false, line: false, formatTime: (v) => `t${v}` }), h(Timeline, { items, dot: (_x, i) => h("b", {}, String(i + 1)) })]);
  const [a, b, c] = m.el.querySelectorAll("ol.m-timeline");
  assert.equal(a.querySelector(".m-tl-dot").getAttribute("data-m-color"), "brand-purple");
  assert.ok(a.querySelector(".m-tl-item").classList.contains("is-mine"), "an item's own class");
  assert.ok(!a.className.includes("m-timeline-no-line"));
  assert.equal(a.querySelectorAll(".m-tl-line").length, 1, "a line from each item to the next (none after the last)");
  assert.equal(b.querySelectorAll(".m-tl-line").length, 0, "line={false}: no line element");
  assert.equal(b.querySelector(".m-tl-dot"), null);
  assert.ok(b.className.includes("m-timeline-no-line"));
  assert.equal(b.querySelector("time").textContent, "t5");
  assert.deepEqual([...c.querySelectorAll(".m-tl-dot.is-own")].map((x) => x.textContent), ["1", "2"]);
  m.dispose();
});
