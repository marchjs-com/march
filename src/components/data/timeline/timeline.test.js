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
  const ol = m.el.querySelector("ol.hm-timeline");
  const items = ol.querySelectorAll(".hm-tl-item");
  assert.equal(items.length, 3);
  assert.ok(items[0].className.includes("hm-tl-info"));
  assert.equal(items[0].querySelector("time").textContent, "Today");
  assert.equal(items[1].querySelector("time").getAttribute("datetime"), when.toISOString());
  assert.notEqual(items[1].querySelector("time").textContent, "", "dates are formatted");
  assert.equal(items[2].querySelector("time"), null);
  assert.equal(items[0].querySelector(".hm-tl-body").textContent, "#1");
  m.dispose();
});
