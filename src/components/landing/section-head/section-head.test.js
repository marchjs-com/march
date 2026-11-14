import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { SectionHead, sectionActions } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("SectionHead: eyebrow, title, lead, actions, note in order; live text", () => {
  const title = signal("Everything you need");
  let clicks = 0;
  const m = mount(() => h(SectionHead, { eyebrow: "Features", title, lead: "One kit.", note: "No card needed", titleId: "sh1",
    actions: [{ label: "Start", onClick: () => clicks++ }, { label: "Docs", href: "/docs" }, h("a", { class: "own", href: "#x" }, "More")] }));
  const root = m.el.querySelector("div.hm-section-head.hm-section-head-md.hm-section-head-center");
  assert.deepEqual([...root.children].map((c) => c.className.split(" ")[0]), ["hm-section-head-eyebrow", "hm-section-head-title", "hm-section-head-lead", "hm-section-head-actions", "hm-section-head-note"]);
  assert.equal(root.querySelector(".hm-section-head-eyebrow .hm-section-head-caps").textContent, "Features");
  const h2 = root.querySelector("h2.hm-section-head-title");
  assert.equal(h2.id, "sh1");
  title.set("All in one");
  assert.equal(h2.textContent, "All in one");
  const btns = [...root.querySelector(".hm-section-head-actions").children];
  assert.equal(btns.length, 3);
  assert.ok(btns[0].classList.contains("hm-btn-primary"));
  assert.ok(btns[1].classList.contains("hm-btn-secondary"));
  assert.ok(btns[2].classList.contains("own"));
  btns[0].click();
  assert.equal(clicks, 1);
  m.dispose();
});

test("SectionHead: every part is optional; level, align, size, width, color, class; own eyebrow node and link", () => {
  const align = signal("start");
  const m = mount(() => [
    h(SectionHead, { title: "Only a title", as: "h3", align, size: "sm", width: "full", color: "brand-purple", class: "mine" }),
    h(SectionHead, { eyebrow: h("b", { class: "pill" }, "New"), eyebrowHref: "/news", title: "Linked" }),
  ]);
  const [a, b] = m.el.querySelectorAll(".hm-section-head");
  assert.equal(a.children.length, 1);
  assert.equal(a.firstElementChild.tagName, "H3");
  for (const c of ["hm-section-head-start", "hm-section-head-sm", "hm-section-head-full", "mine"]) assert.ok(a.classList.contains(c), c);
  assert.equal(a.getAttribute("data-hm-color"), "brand-purple");
  align.set("end");
  assert.ok(a.classList.contains("hm-section-head-end"));
  const eb = b.querySelector("a.hm-section-head-eyebrow");
  assert.equal(eb.getAttribute("href"), "/news");
  assert.ok(eb.querySelector(".pill"));
  assert.equal(eb.querySelector(".hm-section-head-caps"), null, "an own node is not restyled");
  m.dispose();
});

test("SectionHead: reveal gate wraps the parts in Reveal; off by default", () => {
  const m = mount(() => [h(SectionHead, { title: "Still" }), h(SectionHead, { title: "Moves", reveal: true }), h(SectionHead, { title: "Own", reveal: { effect: "none" } })]);
  const [a, b, c] = m.el.querySelectorAll(".hm-section-head");
  assert.ok(!a.classList.contains("hm-reveal-box"));
  assert.ok(b.classList.contains("hm-reveal-box"));
  assert.ok(c.classList.contains("hm-reveal-box"));
  assert.equal(b.querySelector("h2").textContent, "Moves");
  m.dispose();
});

test("sectionActions: a single node and an empty list", () => {
  const n = document.createElement("i");
  assert.deepEqual(sectionActions(n), [n]);
  assert.deepEqual(sectionActions(undefined), []);
});
