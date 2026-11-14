import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { StatsBand } = await import("./index.ts");

test("StatsBand: dl with dt label and dd counter per item", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(StatsBand, { items: [{ value: 12, label: "teams" }, { value: 99.5, decimals: 1, suffix: "%", label: "uptime", note: "12 mo" }] }), el);
  const dl = el.querySelector("dl.hm-stats");
  assert.ok(dl.className.includes("hm-stats-divided"));
  const items = dl.querySelectorAll(".hm-stats-item");
  assert.equal(items.length, 2);
  assert.equal(items[0].querySelector("dt").textContent, "teams");
  assert.ok(items[1].querySelector("dd .hm-counter"));
  assert.equal(items[1].querySelector(".hm-stat-tile-hint").textContent, "12 mo");
  dispose();
});

test("StatsBand: own colour, plain numbers, no entrance", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(StatsBand, { items: [{ value: 1200, label: "events", suffix: "+" }], color: "brand-orange", mode: "none", reveal: false, class: "mine" }), el);
  const dl = el.querySelector("dl.hm-stats.mine");
  assert.equal(dl.getAttribute("data-hm-color"), "brand-orange");
  assert.equal(dl.querySelector(".hm-counter"), null);
  assert.match(dl.querySelector(".hm-stats-plain").textContent, /^1.?200\+$/);
  assert.ok(dl.classList.contains("is-revealed") && !dl.classList.contains("is-pending"));
  dispose();
});
