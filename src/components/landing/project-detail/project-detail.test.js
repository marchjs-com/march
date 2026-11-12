import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { ProjectDetail } = await import("./index.ts");

test("ProjectDetail: h1, facts, services, shared cover, gallery buttons, back and next", () => {
  let back = 0; const opened = [];
  const el = document.createElement("div"); document.body.appendChild(el);
  const project = { id: "a", title: "Acme", category: "Web", year: 2026, role: "Design", services: ["Brand", "Web"],
    cover: { src: "/a.jpg", alt: "Acme", width: 1600, height: 900 }, gallery: [{ src: "/g.jpg", alt: "G", width: 800, height: 600 }] };
  const next = { project: { id: "b", title: "B", cover: h("div", {}) }, onOpen: (p) => opened.push(p.id) };
  const dispose = render(() => h(ProjectDetail, { project, onBack: () => back++, next }), el);
  assert.equal(el.querySelector("h1").textContent, "Acme");
  assert.ok(el.querySelector('.hm-pd-cover[data-hm-shared="project-a"] img[fetchpriority="high"]'));
  assert.ok(el.querySelector("dl.hm-kv"));
  assert.equal(el.querySelectorAll(".hm-pd-services .hm-chip2").length, 2);
  assert.equal(el.querySelector(".hm-pd-shot").getAttribute("aria-label"), "Open image 1");
  el.querySelector(".hm-pd-back").click();
  assert.equal(back, 1);
  el.querySelector(".hm-pd-next").click();
  assert.deepEqual(opened, ["b"]);
  dispose();
});
