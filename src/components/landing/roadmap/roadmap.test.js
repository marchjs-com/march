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
  const lis = el.querySelectorAll(".hm-tl-item");
  assert.equal(lis.length, 3);
  assert.ok(lis[0].classList.contains("is-done") && lis[1].classList.contains("is-now") && lis[2].classList.contains("is-next"));
  assert.equal(lis[0].querySelector(".hm-rm-badge").textContent, "Done");
  assert.ok(el.querySelector(".hm-rm-rail .hm-rm-fill"));
  dispose();
});
