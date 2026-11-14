import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { mProps } = await import("../../../props/index.ts");
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { ProjectDetail } = await import("./index.ts");

test("ProjectDetail: h1, facts, services, shared cover, gallery buttons, back and next", () => {
  let back = 0; const opened = [];
  const el = document.createElement("div"); document.body.appendChild(el);
  const project = { id: "a", title: "HADİ", category: "Web", year: 2026, role: "Design", services: ["Brand", "Web"],
    cover: { src: "/a.jpg", alt: "HADİ", width: 1600, height: 900 }, gallery: [{ src: "/g.jpg", alt: "G", width: 800, height: 600 }] };
  const next = { project: { id: "b", title: "B", cover: h("div", {}) }, onOpen: (p) => opened.push(p.id) };
  const dispose = render(() => h(ProjectDetail, { project, onBack: () => back++, next }), el);
  assert.equal(el.querySelector("h1").textContent, "HADİ");
  assert.ok(el.querySelector('.m-pd-cover[data-m-shared="project-a"] img[fetchpriority="high"]'));
  assert.ok(el.querySelector("dl.m-kv"));
  assert.equal(el.querySelectorAll(".m-pd-services .m-chip2").length, 2);
  assert.equal(el.querySelector(".m-pd-shot").getAttribute("aria-label"), "Open image 1");
  el.querySelector(".m-pd-back").click();
  assert.equal(back, 1);
  el.querySelector(".m-pd-next").click();
  assert.deepEqual(opened, ["b"]);
  dispose();
});

test("ProjectDetail: own texts, parts off, colour, no reveal", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const project = { id: "a", title: "T", category: "Web", year: 2026, role: "Design", services: ["Brand"], body: "Story",
    cover: h("div", {}), gallery: [{ src: "/g.jpg", alt: "G", width: 800, height: 600 }] };
  const next = { project: { id: "b", title: "B", cover: h("div", {}) }, onOpen: () => {} };
  const dispose = render(() => [
    mProps(h(ProjectDetail, { project, next, onBack: () => {}, class: "one", nextIcon: h("i", { class: "mine" }),
      labels: { back: "Back", next: "Up next", role: "Job", services: "Did", openImage: (n) => `Photo ${n}` } }), { color: "brand-orange" }),
    h(ProjectDetail, { project: { ...project, cover: h("div", {}) }, next: { ...next, project: { ...next.project, cover: h("div", {}) } }, onBack: () => {}, class: "two", facts: false, eyebrow: false, backIcon: false, nextIcon: false, reveal: false }),
  ], el);
  const one = el.querySelector(".one");
  assert.equal(one.getAttribute("data-m-color"), "brand-orange");
  assert.equal(one.querySelector(".m-pd-back").textContent, "Back");
  assert.equal(one.querySelector(".m-pd-next-label").textContent, "Up next");
  assert.ok(one.querySelector(".m-pd-next-title .mine"));
  assert.equal(one.querySelector("dl.m-kv dt").textContent, "Job");
  assert.equal(one.querySelector(".m-pd-services").getAttribute("aria-label"), "Did");
  assert.equal(one.querySelector(".m-pd-shot").getAttribute("aria-label"), "Photo 1");
  assert.ok(one.querySelector(".m-pd-head").classList.contains("m-reveal"));
  const two = el.querySelector(".two");
  assert.equal(two.querySelector("dl.m-kv"), null);
  assert.equal(two.querySelector(".m-section-head-eyebrow"), null);
  assert.equal(two.querySelector(".m-pd-back svg"), null);
  assert.equal(two.querySelector(".m-pd-next-title svg"), null);
  assert.ok(!two.querySelector(".m-pd-head").classList.contains("m-reveal"));
  assert.equal(two.querySelector(".m-pd-body").textContent, "Story");
  dispose();
});
