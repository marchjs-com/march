import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { BottomNav, HADI_RING } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const ITEMS = [{ id: "home", label: "Home" }, { id: "explore", label: "Explore" }, { id: "chat", label: "Chat" }, { id: "me", label: "Me" }];

test("BottomNav: nav landmark, aria-current, onChange, the bubble follows the active slot", () => {
  const tab = signal("home");
  const m = mount(() => h(BottomNav, { items: ITEMS, value: tab, onChange: (id) => tab.set(id) }));
  const nav = m.el.querySelector("nav.m-bnav");
  assert.equal(nav.getAttribute("aria-label"), "Main");
  const tabs = nav.querySelectorAll(".m-bnav-item");
  assert.equal(tabs.length, 4);
  assert.equal(tabs[0].getAttribute("aria-current"), "page");
  assert.equal(tabs[2].getAttribute("aria-label"), "Chat");
  tabs[2].click();
  assert.equal(tab(), "chat");
  assert.equal(tabs[2].getAttribute("aria-current"), "page");
  assert.equal(tabs[0].getAttribute("aria-current"), null);
  const bubble = nav.querySelector(".m-bnav-bubble");
  assert.equal(bubble.style.getPropertyValue("--m-bnav-i"), "2");
  // brand tint: the active tab's color (third of the four HADİ colors)
  assert.equal(bubble.getAttribute("data-m-color"), "brand-green");
  m.dispose();
});

test("BottomNav: the Create button sits in the middle slot with the four-color ring", () => {
  let made = 0;
  const tab = signal("me");
  const m = mount(() => h(BottomNav, { items: ITEMS, value: tab, onCreate: () => made++, tint: "accent" }));
  const bar = m.el.querySelector(".m-bnav-bar");
  assert.equal(bar.style.getPropertyValue("--m-bnav-n"), "5");
  const kids = [...bar.children].filter((c) => !c.classList.contains("m-bnav-bubble"));
  assert.ok(kids[2].classList.contains("m-bnav-create-slot"));
  const btn = kids[2].querySelector("button");
  assert.equal(btn.getAttribute("aria-label"), "Create");
  btn.click();
  assert.equal(made, 1);
  const ring = m.el.querySelector(".m-bnav-ring").style.getPropertyValue("--m-bnav-ring");
  for (const c of ["#F2801F", "#1D9AD6", "#78BE3A", "#A3338C"]) assert.ok(ring.includes(c), c);
  assert.equal(HADI_RING.length, 4);
  // the last tab sits after the Create slot; accent tint: no per-tab color
  const bubble = m.el.querySelector(".m-bnav-bubble");
  assert.equal(bubble.style.getPropertyValue("--m-bnav-i"), "4");
  assert.equal(bubble.getAttribute("data-m-color"), null);
  m.dispose();
});

test("BottomNav: count and dot badges, labels off keep the accessible name, links", () => {
  const unread = signal(120);
  const m = mount(() => h(BottomNav, { labels: false, value: "x", items: [{ id: "a", label: "Inbox", badge: unread, href: "#/inbox" }, { id: "b", label: "Me", dot: true }] }));
  assert.equal(m.el.querySelector(".m-bnav-badge").textContent, "99+");
  unread.set(0);
  assert.equal(m.el.querySelector(".m-bnav-badge"), null);
  assert.ok(m.el.querySelector(".m-bnav-dot"));
  assert.equal(m.el.querySelector(".m-bnav-label"), null);
  const link = m.el.querySelector("a.m-bnav-item");
  assert.equal(link.getAttribute("href"), "#/inbox");
  assert.equal(link.getAttribute("aria-label"), "Inbox");
  assert.ok(m.el.querySelector(".m-bnav-bubble").classList.contains("is-hidden"));
  m.dispose();
});

test("BottomNav: the Create menu opens on the layer stack, picks an action, Escape closes it", async () => {
  const picked = [], ran = [];
  const actions = [{ id: "post", label: "Post", run: () => ran.push("post") }, { id: "story", label: "Story" }, { id: "live", label: "Live", disabled: true }];
  for (const look of ["fan", "stack", "sheet"]) {
    const m = mount(() => h(BottomNav, { items: ITEMS, value: "home", createActions: actions, createMenu: look, createTitle: "Create", onAction: (id) => picked.push(id) }));
    const btn = m.el.querySelector(".m-bnav-create");
    assert.equal(btn.getAttribute("aria-haspopup"), "menu");
    assert.equal(btn.getAttribute("aria-expanded"), "false");
    btn.click();
    assert.equal(btn.getAttribute("aria-expanded"), "true");
    // the sheet is a Drawer, loaded when the first one opens
    for (let i = 0; i < 100 && !document.querySelector(`.m-bnav-actions.is-${look}`); i++) await new Promise((r) => setTimeout(r, 20));
    const menu = document.querySelector(`.m-bnav-actions.is-${look}`);
    assert.ok(menu, `${look}: the menu opened`);
    assert.equal(menu.getAttribute("role"), "menu");
    assert.equal(menu.querySelectorAll("[role=menuitem]").length, 3);
    assert.ok(!m.el.contains(menu), "the menu is on the layer stack, not inside the bar");
    if (look === "fan") menu.querySelector("[role=menuitem]").click();
    else menu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((r) => setTimeout(r, look === "sheet" ? 400 : 220));
    assert.equal(document.querySelector(`.m-bnav-actions.is-${look}`), null, `${look}: closed`);
    assert.equal(btn.getAttribute("aria-expanded"), "false");
    m.dispose();
  }
  assert.deepEqual(picked, ["post"]);
  assert.deepEqual(ran, ["post"]);
});

test("BottomNav: bubble, ring and motion can be turned off; ring takes color tokens; the sheet heading and handle are optional", async () => {
  const tab = signal("home");
  const m = mount(() => h(BottomNav, { items: ITEMS, value: tab, onCreate: () => {}, bubble: false, ring: false, motion: false, class: "mine" }));
  const nav = m.el.querySelector("nav.m-bnav");
  assert.ok(nav.classList.contains("mine") && nav.classList.contains("m-bnav-nobubble"));
  assert.ok(nav.querySelector(".m-bnav-bubble").classList.contains("is-hidden"));
  assert.equal(nav.querySelector(".m-bnav-ring"), null);
  assert.ok(nav.querySelector(".m-bnav-core"));
  m.dispose();
  const r = mount(() => h(BottomNav, { items: ITEMS, value: tab, onCreate: () => {}, ring: ["primary", "#123456"] }));
  const paint = r.el.querySelector(".m-bnav-ring").style.getPropertyValue("--m-bnav-ring");
  assert.match(paint, /var\(--m-primary\)/);
  assert.match(paint, /#123456/);
  r.dispose();
  const s = mount(() => h(BottomNav, { items: ITEMS, value: tab, createActions: [{ id: "a", label: "A" }], createMenu: "sheet", createTitle: false, createHandle: false, motion: false }));
  s.el.querySelector(".m-bnav-create").click();
  for (let i = 0; i < 100 && !document.querySelector(".m-bnav-actions.is-sheet"); i++) await new Promise((r) => setTimeout(r, 20));
  const menu = document.querySelector(".m-bnav-actions.is-sheet");
  assert.ok(menu);
  assert.equal(menu.getAttribute("aria-label"), "Create");
  const sheet = menu.closest(".m-bnav-sheet");
  assert.ok(sheet, "the sheet is a Drawer");
  assert.equal(sheet.querySelector(".m-dialog-title"), null, "createTitle={false}");
  assert.equal(sheet.querySelector(".m-sheet-handle"), null, "createHandle={false}");
  menu.querySelector(".m-bnav-action").click();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(document.querySelector(".m-bnav-actions"), null, "without motion the menu closes at once");
  s.dispose();
});
