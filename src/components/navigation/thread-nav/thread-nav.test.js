import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { ThreadNav, threadPath } = await import("./index.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const key = (el, k) => el.dispatchEvent(Object.assign(new Event("keydown", { bubbles: true, cancelable: true }), { key: k }));
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const P = (id, label, desc) => ({ id, label, desc });
const TREE = [
  { id: "a", label: "Start", color: "brand-orange", children: [{ id: "a1", label: "First steps", count: 2, children: [P("a1x", "Install", "Get it"), P("a1y", "CLI")] }] },
  { id: "b", label: "Components", color: "brand-blue", children: [
    { id: "b1", label: "Forms", count: 2, children: [P("b1x", "Field"), P("b1y", "Select")] },
    { id: "b2", label: "Charts", count: 2, desc: "Lines and bars", children: [P("b2x", "Line"), P("b2y", "Bar")] },
  ] },
  { id: "c", label: "About", href: "/about" },
];

test("threadPath: the path from the section to an item", () => {
  assert.deepEqual(threadPath(TREE, "b2y").map((x) => x.id), ["b", "b2", "b2y"]);
  assert.deepEqual(threadPath(TREE, "nope"), []);
});

test("ThreadNav: a named rail of beads; where you are is current, the one tab stop, and the drop's section colour", () => {
  const [el, dispose] = mount(() => h(ThreadNav, { items: TREE, value: "b1x" }));
  const rail = el.querySelector("nav.m-thn-rail");
  assert.equal(rail.getAttribute("aria-label"), "Navigation");
  const beads = [...el.querySelectorAll(".m-thn-bead")];
  assert.deepEqual(beads.map((b) => b.getAttribute("aria-label")), ["Start", "Components", "About"]);
  assert.equal(beads[1].getAttribute("aria-current"), "location");
  assert.deepEqual(beads.map((b) => b.getAttribute("tabindex")), ["-1", "0", "-1"]);
  assert.equal(beads[1].getAttribute("aria-expanded"), "false");
  assert.equal(beads[2].getAttribute("aria-expanded"), null, "no capsule: no aria-expanded");
  assert.equal(el.querySelector(".m-thn-drop").getAttribute("data-m-color"), "brand-blue");
  dispose();
});

test("ThreadNav: a bead opens its capsule (categories with counts, the current one's pages on a thread); a page navigates and closes", async () => {
  const seen = [];
  const [el, dispose] = mount(() => h(ThreadNav, { items: TREE, value: "b1x", onNavigate: (it, path) => seen.push([it.id, path.map((x) => x.id).join("/")]) }));
  el.querySelectorAll(".m-thn-bead")[1].click();
  const panel = el.querySelector(".m-thn-panel");
  assert.ok(panel, "the capsule opens");
  assert.equal(panel.getAttribute("data-m-color"), "brand-blue");
  assert.equal(el.querySelectorAll(".m-thn-bead")[1].getAttribute("aria-expanded"), "true");
  const cats = [...panel.querySelectorAll(".m-thn-cat-link")];
  assert.deepEqual(cats.map((c) => c.querySelector(".m-thn-text").textContent), ["Forms", "Charts"]);
  assert.equal(cats[0].querySelector(".m-thn-count").textContent, "2");
  // where you are is open: its pages on the second thread, the page current
  const pages = [...panel.querySelectorAll(".m-thn-page-link")];
  assert.deepEqual(pages.map((p) => p.textContent), ["Field", "Select"]);
  assert.equal(pages[0].getAttribute("aria-current"), "page");
  cats[1].click();
  assert.deepEqual([...panel.querySelectorAll(".m-thn-page-link")].map((p) => p.textContent), ["Line", "Bar"], "one category open at a time");
  panel.querySelectorAll(".m-thn-page-link")[1].click();
  assert.deepEqual(seen, [["b2y", "b/b2/b2y"]]);
  assert.equal(el.querySelector(".m-thn-panel"), null, "closes after navigating");
  // a section without children navigates itself
  el.querySelectorAll(".m-thn-bead")[2].click();
  assert.deepEqual(seen.at(-1), ["c", "c"]);
  dispose();
});

test("ThreadNav: the search filters categories and pages and opens the matches; the description shows for the row in focus", async () => {
  const [el, dispose] = mount(() => h(ThreadNav, { items: TREE, value: "b1x" }));
  el.querySelectorAll(".m-thn-bead")[1].click();
  const input = el.querySelector(".m-thn-search input");
  assert.ok(input, "a SearchBox");
  input.value = "bar"; input.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
  const panel = el.querySelector(".m-thn-panel");
  assert.deepEqual([...panel.querySelectorAll(".m-thn-cat-link .m-thn-text")].map((c) => c.textContent), ["Charts"]);
  assert.deepEqual([...panel.querySelectorAll(".m-thn-page-link")].map((p) => p.textContent), ["Bar"]);
  input.value = "zzz"; input.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
  assert.equal(panel.querySelector(".m-thn-empty").textContent, "Nothing matches");
  input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
  panel.querySelectorAll(".m-thn-cat-link")[1].dispatchEvent(new Event("focus"));
  assert.equal(panel.querySelector(".m-thn-hint").textContent, "Lines and bars");
  dispose();
});

test("ThreadNav: by keyboard: arrows on the rail, Right into the capsule, Right / Left through the levels, Escape back to the bead", async () => {
  const [el, dispose] = mount(() => h(ThreadNav, { items: TREE, value: "a1x" }));
  const list = el.querySelector(".m-thn-list"), beads = [...el.querySelectorAll(".m-thn-bead")];
  beads[0].focus();
  key(list, "ArrowDown"); assert.equal(document.activeElement, beads[1]);
  key(list, "ArrowRight");
  await tick();
  const panel = el.querySelector(".m-thn-panel");
  assert.ok(panel);
  assert.ok(document.activeElement.classList.contains("m-thn-row"), "focus went into the capsule");
  const forms = panel.querySelectorAll(".m-thn-cat-link")[0];
  forms.focus();
  key(panel, "ArrowRight");
  await tick();
  assert.equal(document.activeElement.textContent, "Field", "Right opens the category and goes to its first page");
  key(panel, "ArrowLeft");
  assert.equal(document.activeElement, panel.querySelectorAll(".m-thn-cat-link")[0], "Left: back to the category");
  key(panel, "Escape");
  assert.equal(el.querySelector(".m-thn-panel"), null);
  assert.equal(document.activeElement, beads[1], "back on the bead");
  dispose();
});

test("ThreadNav: while closed the path shows in a small capsule; its section bead opens the capsule there", () => {
  const value = signal("b2x");
  const [el, dispose] = mount(() => h(ThreadNav, { items: TREE, value }));
  const crumbs = [...el.querySelectorAll(".m-thn-crumb button")];
  assert.deepEqual(crumbs.map((c) => c.textContent), ["Components", "Charts", "Line"]);
  assert.equal(crumbs[2].getAttribute("aria-current"), "location");
  crumbs[1].click();
  assert.ok(el.querySelector(".m-thn-panel"), "opens");
  assert.equal(el.querySelector(".m-thn-crumbs"), null, "the path hides while the capsule is open");
  assert.equal(el.querySelector(".m-thn-cat.is-open .m-thn-text").textContent, "Charts");
  dispose();
  const [el2, d2] = mount(() => h(ThreadNav, { items: TREE, value: "b2x", crumbs: false }));
  assert.equal(el2.querySelector(".m-thn-crumbs"), null);
  d2();
});
