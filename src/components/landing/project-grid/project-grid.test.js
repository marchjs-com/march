import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
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
  const chips = el.querySelectorAll(".hm-pg-filters .hm-chip2-hit");
  assert.equal(chips.length, 3);
  assert.equal(el.querySelector("img").getAttribute("width"), "800");
  chips[2].click(); // Brand
  await new Promise((r) => setTimeout(r, 400));
  const cards = el.querySelectorAll(".hm-pg-card");
  assert.deepEqual([...cards].map((c) => !!c.hidden), [true, false, true]);
  assert.equal(chips[2].getAttribute("aria-pressed"), "true");
  cards[1].querySelector(".hm-pg-link").click();
  assert.deepEqual(opened, [["b", "b"]]);
  dispose();
});
