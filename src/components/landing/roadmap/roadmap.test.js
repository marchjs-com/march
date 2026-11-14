import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Roadmap } = await import("./index.ts");

test("Roadmap: timeline items with status classes and badges, rail fill", async () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(Roadmap, { items: [{ time: "Q1", title: "A", status: "done" }, { time: "Q2", title: "B", status: "now" }, { title: "C" }] }), el);
  await Promise.resolve();
  const lis = el.querySelectorAll(".m-tl-item");
  assert.equal(lis.length, 3);
  assert.ok(lis[0].classList.contains("is-done") && lis[1].classList.contains("is-now") && lis[2].classList.contains("is-next"));
  assert.equal(lis[0].querySelector(".m-rm-badge").textContent, "Done");
  assert.ok(el.querySelector(".m-rm-rail .m-progress2-fill"));
  dispose();
});

test("Roadmap: own status texts, own badge, no rail, colour, no reveal", async () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const items = [{ title: "A", status: "done" }, { title: "B", status: "now" }];
  const dispose = render(() => [
    h(Roadmap, { items, class: "one", color: "brand-purple", labels: { done: "Shipped" } }),
    h(Roadmap, { items, class: "two", rail: false, reveal: false, badges: (s, text) => h("em", { class: "mine" }, `${s}:${text}`) }),
  ], el);
  await Promise.resolve();
  const one = el.querySelector(".one");
  assert.equal(one.getAttribute("data-m-color"), "brand-purple");
  assert.deepEqual([...one.querySelectorAll(".m-rm-badge")].map((b) => b.textContent), ["Shipped", "In progress"]);
  const two = el.querySelector(".two");
  assert.equal(two.querySelector(".m-rm-rail"), null);
  assert.equal(two.querySelector(".m-rm-badge"), null);
  assert.deepEqual([...two.querySelectorAll(".mine")].map((b) => b.textContent), ["done:Done", "now:In progress"]);
  assert.ok(!two.querySelector(".m-rm-tl").classList.contains("m-reveal"));
  dispose();
});
