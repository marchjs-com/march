import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { ListRow } = await import("./index.ts");
const { home } = await import("../../../icons/glyphs/home.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("ListRow: a plain row with lead, title, sub and trail", () => {
  const sub = signal("Overview");
  const [el, dispose] = mount(() => h(ListRow, { lead: home, title: "Home", sub, trail: h("b", { class: "t" }, "3"), "data-id": "home", tooltip: "Go home" }));
  const r = el.querySelector(".m-listrow");
  assert.equal(r.tagName, "DIV");
  assert.ok(r.classList.contains("m-listrow-md") && !r.classList.contains("is-action"));
  assert.ok(r.querySelector(".m-listrow-lead .m-listrow-icon svg"), "an icon in the lead slot");
  assert.equal(r.querySelector(".m-listrow-title").textContent, "Home");
  assert.ok(r.querySelector(".m-listrow-title").classList.contains("m-marquee"), "text titles are OverflowText");
  assert.equal(r.querySelector(".m-listrow-sub").textContent, "Overview");
  sub.set("Changed");
  assert.equal(r.querySelector(".m-listrow-sub").textContent, "Changed");
  assert.ok(r.querySelector(".m-listrow-trail .t"));
  assert.equal(r.getAttribute("data-id"), "home");
  assert.equal(r.getAttribute("title"), "Go home");
  dispose();
});

test("ListRow: a button with onClick; active, selected, disabled", () => {
  const active = signal(false), selected = signal(false), disabled = signal(false);
  let clicks = 0;
  const [el, dispose] = mount(() => h(ListRow, { title: "Row", onClick: () => clicks++, active, selected, disabled, size: "sm", color: "brand-green", indicator: true, class: "mine" }));
  const b = el.querySelector("button.m-listrow");
  assert.equal(b.getAttribute("type"), "button");
  for (const k of ["m-listrow-sm", "is-action", "is-barred", "mine"]) assert.ok(b.classList.contains(k), k);
  assert.equal(b.getAttribute("data-m-color"), "brand-green");
  assert.equal(b.getAttribute("aria-pressed"), "false");
  b.click();
  assert.equal(clicks, 1);
  active.set(true); selected.set(true);
  assert.ok(b.classList.contains("is-active") && b.classList.contains("is-selected"));
  assert.equal(b.getAttribute("aria-pressed"), "true");
  disabled.set(true);
  assert.equal(b.disabled, true);
  assert.ok(b.classList.contains("is-disabled"));
  dispose();
});

test("ListRow: a link with href; aria-current while active; actions sit beside it", () => {
  const active = signal(true);
  const [el, dispose] = mount(() => h(ListRow, { title: "Events", href: "/events", active, actions: h("button", { class: "act" }, "x") }));
  const wrap = el.querySelector(".m-listrow-wrap"), a = wrap.querySelector("a.m-listrow");
  assert.equal(a.getAttribute("href"), "/events");
  assert.equal(a.getAttribute("aria-current"), "page");
  active.set(false);
  assert.equal(a.getAttribute("aria-current"), null);
  assert.equal(a.querySelector(".act"), null, "no control inside the link");
  assert.ok(wrap.children[1].classList.contains("m-listrow-actions") && wrap.children[1].querySelector(".act"));
  dispose();
});

test("ListRow: any role on a plain element; selected said by the role; roving focus attributes", () => {
  let got = null, clicks = 0;
  const sel = signal(false), off = signal(false);
  const [el, dispose] = mount(() => h("ul", { role: "listbox" },
    h(ListRow, { as: "li", role: "option", id: "o1", tabindex: "-1", selected: sel, interactive: true, title: "One", ref: (n) => { got = n; } }),
    h(ListRow, { as: "li", role: "menuitemradio", selected: true, title: "Two", disabled: off, onClick: () => clicks++, actions: h("i", { class: "act" }) }),
    h(ListRow, { as: "span", overflow: "ellipsis", align: "start" }, "Child title")));
  const [a, b, c] = el.querySelectorAll(".m-listrow");
  assert.equal(a.tagName, "LI");
  assert.equal(a.getAttribute("role"), "option");
  assert.equal(a.getAttribute("tabindex"), "-1");
  assert.equal(a.getAttribute("aria-selected"), "false");
  assert.ok(a.classList.contains("is-action"), "interactive: hover look");
  assert.equal(got, a, "ref reaches the row element");
  sel.set(true);
  assert.equal(a.getAttribute("aria-selected"), "true");
  assert.equal(b.getAttribute("aria-checked"), "true");
  assert.ok(b.querySelector(".m-listrow-actions .act"), "a plain row keeps its actions inside");
  b.click();
  assert.equal(clicks, 1);
  off.set(true);
  assert.equal(b.getAttribute("aria-disabled"), "true");
  b.click();
  assert.equal(clicks, 1, "a disabled row does not act");
  assert.equal(c.tagName, "SPAN");
  assert.ok(c.classList.contains("is-ellipsis") && c.classList.contains("is-top"));
  assert.equal(c.querySelector(".m-listrow-title").textContent, "Child title");
  assert.ok(!c.querySelector(".m-listrow-title").classList.contains("m-marquee"), "ellipsis: a plain span");
  dispose();
});

test("ListRow: node title and lead node pass through", () => {
  const [el, dispose] = mount(() => h(ListRow, { lead: h("img", { class: "thumb", alt: "" }), title: h("strong", null, "Bold"), sub: h("em", null, "note") }));
  const r = el.querySelector(".m-listrow");
  assert.ok(r.querySelector(".m-listrow-lead .thumb"));
  assert.ok(r.querySelector(".m-listrow-title strong"));
  assert.ok(r.querySelector(".m-listrow-sub em"));
  dispose();
});

test("ListRow: as=\"button\" is a button without onClick; the host's listeners pass through", () => {
  let downs = 0;
  const [el, dispose] = mount(() => h(ListRow, { as: "button", title: "Drag me", onPointerdown: () => downs++ }));
  const r = el.querySelector("button.m-listrow");
  assert.equal(r.getAttribute("type"), "button");
  assert.ok(r.classList.contains("is-action"));
  r.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  assert.equal(downs, 1);
  dispose();
});

test("ListRow: a tile: direction=\"column\", titleAs / subAs, as=\"article\"", () => {
  const dir = signal("column");
  const [el, dispose] = mount(() => [
    h(ListRow, { as: "article", direction: dir, align: "center", titleAs: "h3", subAs: "p", title: "Fast", sub: "Every route is a lazy chunk.", lead: home }),
    h(ListRow, { title: "Plain", sub: "Row" }),
  ]);
  const [tile, row] = el.querySelectorAll(".m-listrow");
  assert.equal(tile.tagName.toLowerCase(), "article");
  assert.ok(tile.classList.contains("is-column") && tile.classList.contains("is-centered"));
  assert.equal(tile.querySelector("h3.m-listrow-title").textContent, "Fast");
  assert.equal(tile.querySelector("p.m-listrow-sub").textContent, "Every route is a lazy chunk.");
  assert.equal(tile.querySelector(".m-listrow-text").tagName.toLowerCase(), "div", "headings and paragraphs sit in a block");
  dir.set("row");
  assert.ok(!tile.classList.contains("is-column") && !tile.classList.contains("is-centered"));
  assert.ok(!row.classList.contains("is-column"));
  assert.equal(row.querySelector(".m-listrow-text").tagName.toLowerCase(), "span");
  dispose();
});

test("PlainListRow (core.ts): the same row without the scrolling text; plain titles are cut", async () => {
  const { PlainListRow } = await import("./core.ts");
  const [el, dispose] = mount(() => h(PlainListRow, { title: "A long title", sub: "Sub", lead: home, onClick: () => {} }));
  const r = el.querySelector("button.m-listrow");
  assert.ok(r.classList.contains("is-ellipsis") && r.classList.contains("is-action"));
  assert.equal(r.querySelector(".m-overflow-text, .m-ot"), null);
  assert.equal(r.querySelector(".m-listrow-title").textContent, "A long title");
  dispose();
});

test("ListRow: size xs", () => {
  const [el, dispose] = mount(() => h(ListRow, { size: "xs", title: "main" }));
  assert.ok(el.querySelector(".m-listrow").classList.contains("m-listrow-xs"));
  dispose();
});
