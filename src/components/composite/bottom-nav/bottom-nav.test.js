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
  const nav = m.el.querySelector("nav.hm-bnav");
  assert.equal(nav.getAttribute("aria-label"), "Main");
  const tabs = nav.querySelectorAll(".hm-bnav-item");
  assert.equal(tabs.length, 4);
  assert.equal(tabs[0].getAttribute("aria-current"), "page");
  assert.equal(tabs[2].getAttribute("aria-label"), "Chat");
  tabs[2].click();
  assert.equal(tab(), "chat");
  assert.equal(tabs[2].getAttribute("aria-current"), "page");
  assert.equal(tabs[0].getAttribute("aria-current"), null);
  const bubble = nav.querySelector(".hm-bnav-bubble");
  assert.equal(bubble.style.getPropertyValue("--hm-bnav-i"), "2");
  // brand tint: the active tab's color (third of the four HADİ colors)
  assert.equal(bubble.getAttribute("data-hm-color"), "brand-green");
  m.dispose();
});

test("BottomNav: the Create button sits in the middle slot with the four-color ring", () => {
  let made = 0;
  const tab = signal("me");
  const m = mount(() => h(BottomNav, { items: ITEMS, value: tab, onCreate: () => made++, tint: "accent" }));
  const bar = m.el.querySelector(".hm-bnav-bar");
  assert.equal(bar.style.getPropertyValue("--hm-bnav-n"), "5");
  const kids = [...bar.children].filter((c) => !c.classList.contains("hm-bnav-bubble"));
  assert.ok(kids[2].classList.contains("hm-bnav-create-slot"));
  const btn = kids[2].querySelector("button");
  assert.equal(btn.getAttribute("aria-label"), "Create");
  btn.click();
  assert.equal(made, 1);
  const ring = m.el.querySelector(".hm-bnav-ring").style.getPropertyValue("--hm-bnav-ring");
  for (const c of ["#F2801F", "#1D9AD6", "#78BE3A", "#A3338C"]) assert.ok(ring.includes(c), c);
  assert.equal(HADI_RING.length, 4);
  // the last tab sits after the Create slot; accent tint: no per-tab color
  const bubble = m.el.querySelector(".hm-bnav-bubble");
  assert.equal(bubble.style.getPropertyValue("--hm-bnav-i"), "4");
  assert.equal(bubble.getAttribute("data-hm-color"), null);
  m.dispose();
});

test("BottomNav: count and dot badges, labels off keep the accessible name, links", () => {
  const unread = signal(120);
  const m = mount(() => h(BottomNav, { labels: false, value: "x", items: [{ id: "a", label: "Inbox", badge: unread, href: "#/inbox" }, { id: "b", label: "Me", dot: true }] }));
  assert.equal(m.el.querySelector(".hm-bnav-badge").textContent, "99+");
  unread.set(0);
  assert.equal(m.el.querySelector(".hm-bnav-badge"), null);
  assert.ok(m.el.querySelector(".hm-bnav-dot"));
  assert.equal(m.el.querySelector(".hm-bnav-label"), null);
  const link = m.el.querySelector("a.hm-bnav-item");
  assert.equal(link.getAttribute("href"), "#/inbox");
  assert.equal(link.getAttribute("aria-label"), "Inbox");
  assert.ok(m.el.querySelector(".hm-bnav-bubble").classList.contains("is-hidden"));
  m.dispose();
});
