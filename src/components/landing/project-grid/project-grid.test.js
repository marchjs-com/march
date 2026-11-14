import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { mProps } = await import("../../../props/index.ts");
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { ProjectGrid } = await import("./index.ts");

const projects = [
  { id: "a", title: "A", category: "Web", cover: { src: "/a.jpg", alt: "A", width: 800, height: 600 } },
  { id: "b", title: "B", category: "Brand", cover: h("div", {}) },
  { id: "c", title: "C", category: "Web", cover: h("div", {}) },
];

test("ProjectGrid: chips per category, filtering hides others, onOpen gets the cover", async () => {
  const opened = [];
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(ProjectGrid, { projects, onOpen: (p, cover) => opened.push([p.id, cover.getAttribute("data-project")]) }), el);
  const chips = el.querySelectorAll(".m-pg-filters .m-chip2-hit");
  assert.equal(chips.length, 3);
  assert.equal(el.querySelector("img").getAttribute("width"), "800");
  chips[2].click(); // Brand
  await new Promise((r) => setTimeout(r, 400));
  const cards = el.querySelectorAll(".m-pg-card");
  assert.deepEqual([...cards].map((c) => !!c.hidden), [true, false, true]);
  assert.equal(chips[2].getAttribute("aria-pressed"), "true");
  cards[1].querySelector(".m-pg-link").click();
  assert.deepEqual(opened, [["b", "b"]]);
  dispose();
});

test("ProjectGrid: no arrow / own arrow, chip colour, own group name, instant filter, no reveal", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => [
    mProps(h(ProjectGrid, { projects, class: "one", arrow: false, motion: false, reveal: false, filtersLabel: "Pick" }), { color: "brand-purple" }),
    h(ProjectGrid, { projects, class: "two", arrow: (p) => h("b", { class: "mine" }, p.id) }),
  ], el);
  const one = el.querySelector(".one");
  assert.equal(one.querySelector(".m-pg-go"), null);
  assert.equal(one.querySelector(".m-pg-filters").getAttribute("aria-label"), "Pick");
  assert.equal(one.querySelector(".m-pg-filters .m-chip2").closest("[data-m-color]")?.getAttribute("data-m-color"), "brand-purple");
  assert.ok(!one.querySelector(".m-pg-grid").classList.contains("m-reveal"));
  one.querySelectorAll(".m-pg-filters .m-chip2-hit")[2].click(); // Brand: no animation, hidden at once
  assert.deepEqual([...one.querySelectorAll(".m-pg-card")].map((c) => !!c.hidden), [true, false, true]);
  assert.deepEqual([...el.querySelectorAll(".two .m-pg-go.is-own .mine")].map((b) => b.textContent), ["a", "b", "c"]);
  dispose();
});
