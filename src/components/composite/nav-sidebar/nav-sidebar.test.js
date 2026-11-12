import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { signal, h, render } = await import("../../../index.ts");
const R = await import("../../../router/index.ts");
const U = await import("../../../ui/index.ts");

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const key = (el, k, init = {}) => el.dispatchEvent(new Event("keydown", { key: k, bubbles: true, cancelable: true, ...init }));

const ITEMS = [
  { id: "members", label: "Üyeler", href: "/members", group: "Üyeler ve roller", keywords: "members" },
  { id: "roles", label: "Roller", href: "/roles", group: "Üyeler ve roller" },
  { id: "payments", label: "Ödemeler", href: "/payments", group: "Ekonomi" },
  { id: "refunds", label: "İadeler", href: "/refunds", group: "Ekonomi" },
  { id: "diamonds", label: "Elmas & Akçe", href: "/diamonds", group: "Ekonomi" },
];

test("NavSidebar: categories with counts, auto-open active category, recent list, featured badge, persistence", async () => {
  localStorage.clear();
  R.createRouter({ routes: Object.fromEntries(["/", "/members", "/roles", "/payments", "/refunds", "/diamonds", "/support"].map((p) => [p, { component: () => null }])) });
  const awaiting = signal(3);
  const props = { items: ITEMS, title: "HADİ Yönetim", storageKey: "t.sb", hotkey: false,
    featured: [{ id: "support", label: "Destek talepleri", sub: () => (awaiting() ? `${awaiting()} yanıt bekliyor` : "Yanıt bekleyen talep yok"), href: "/support", badge: awaiting }] };
  let m = mount(() => h(U.NavSidebar, props));
  await tick();
  const groups = () => [...m.el.querySelectorAll(".hm-sb-gbtn")].map((b) => [b.dataset.group, b.querySelector(".hm-sb-count").textContent, b.getAttribute("aria-expanded")]);
  assert.deepEqual(groups(), [["Ekonomi", "3", "false"], ["Üyeler ve roller", "2", "false"]]);
  assert.equal(m.el.querySelector(".hm-sb-featured .hm-sb-badge").textContent, "3");
  awaiting.set(0); await tick();
  assert.equal(m.el.querySelector(".hm-sb-featured .hm-sb-badge"), null);
  assert.ok(m.el.querySelector(".hm-sb-featured").textContent.includes("Yanıt bekleyen talep yok"));

  R.navigate("/refunds"); await tick();
  assert.deepEqual(groups()[0], ["Ekonomi", "3", "true"], "the category of the current page opens");
  assert.ok(m.el.querySelector('.hm-sb-group.is-active-group [data-id="refunds"]').classList.contains("is-active"));
  R.navigate("/members"); await tick();
  const recent = [...m.el.querySelectorAll('[data-where="recent"]')].map((a) => [a.dataset.id, a.querySelector(".hm-sb-sub").textContent]);
  assert.deepEqual(recent, [["members", "Üyeler ve roller"], ["refunds", "Ekonomi"]]);

  // both categories were opened by the visits above, so the link reads "Collapse all"
  assert.equal(m.el.querySelector(".hm-sb-all").textContent, "Collapse all");
  m.el.querySelector(".hm-sb-all").click(); await tick();
  assert.ok(groups().every((g) => g[2] === "false"), "collapse all");
  m.el.querySelector(".hm-sb-all").click(); await tick();
  assert.ok(groups().every((g) => g[2] === "true"), "expand all");
  m.el.querySelector(".hm-sb-all").click(); await tick();
  m.el.querySelector('[data-group="Ekonomi"]').click(); await tick();
  m.dispose();
  m = mount(() => h(U.NavSidebar, props)); await tick();
  assert.deepEqual(groups()[0], ["Ekonomi", "3", "true"], "open categories are remembered");
  assert.equal(m.el.querySelectorAll('[data-where="recent"]').length, 2, "recent visits are remembered");
  m.dispose();
});

test("NavSidebar: typing filters across categories; keyboard moves, opens and closes", async () => {
  localStorage.clear();
  R.navigate("/"); await tick();
  const m = mount(() => h(U.NavSidebar, { items: ITEMS, storageKey: "t.sb2", hotkey: false, recent: 0 }));
  await tick();
  const input = m.el.querySelector(".hm-sb-input");
  input.value = "iade"; input.dispatchEvent(new Event("input", { bubbles: true })); await tick();
  const hits = [...m.el.querySelectorAll('[data-where="search"]')];
  assert.deepEqual(hits.map((a) => a.dataset.id), ["refunds"]);
  assert.equal(hits[0].querySelector(".hm-sb-sub").textContent, "Ekonomi");
  key(input, "Escape"); await tick();
  assert.equal(m.el.querySelectorAll('[data-where="search"]').length, 0);

  key(input, "ArrowDown");
  assert.equal(document.activeElement.dataset.group, "Ekonomi");
  key(document.activeElement, "ArrowRight"); await tick();
  assert.equal(m.el.querySelector('[data-group="Ekonomi"]').getAttribute("aria-expanded"), "true");
  key(document.activeElement, "ArrowDown");
  assert.equal(document.activeElement.dataset.id, "diamonds", "first item inside the opened category (A–Z)");
  key(document.activeElement, "ArrowLeft");
  assert.equal(document.activeElement.dataset.group, "Ekonomi", "← from an item goes to its category");
  key(document.activeElement, "ArrowLeft"); await tick();
  assert.equal(m.el.querySelector('[data-group="Ekonomi"]').getAttribute("aria-expanded"), "false");
  key(document.activeElement, "End");
  assert.equal(document.activeElement.dataset.group, "Üyeler ve roller");
  key(document.activeElement, "Home");
  assert.equal(document.activeElement.dataset.group, "Ekonomi");
  m.dispose();
});

test("NavSidebar resizable: grip with separator ARIA, keyboard widths within min/max, persistence, reset, onResize", async () => {
  localStorage.clear();
  const sizes = [];
  const props = { items: ITEMS, storageKey: "t.sb.rs", hotkey: false, resizable: true, width: 300, minWidth: 220, maxWidth: 420, onResize: (w) => sizes.push(w) };
  let m = mount(() => h(U.NavSidebar, props));
  await tick();
  const wrap = () => m.el.querySelector(".hm-sb-wrap");
  const grip = () => m.el.querySelector(".hm-sb-resize");
  assert.equal(wrap().style.getPropertyValue("--hm-sb-w"), "300px", "width prop → CSS variable (no style attribute string)");
  assert.equal(grip().getAttribute("role"), "separator");
  assert.equal(grip().getAttribute("aria-orientation"), "vertical");
  assert.equal(grip().getAttribute("aria-valuemin"), "220");
  assert.equal(grip().getAttribute("aria-valuemax"), "420");
  assert.equal(grip().getAttribute("tabindex"), "0");
  key(grip(), "End"); await tick();
  assert.equal(wrap().style.getPropertyValue("--hm-sb-w"), "420px");
  assert.equal(grip().getAttribute("aria-valuenow"), "420");
  key(grip(), "ArrowLeft"); await tick();
  assert.equal(wrap().style.getPropertyValue("--hm-sb-w"), "404px", "← narrows by 16px");
  key(grip(), "ArrowLeft", { shiftKey: true }); await tick();
  assert.equal(wrap().style.getPropertyValue("--hm-sb-w"), "340px", "Shift+← by 64px");
  key(grip(), "Home"); await tick();
  assert.equal(wrap().style.getPropertyValue("--hm-sb-w"), "220px");
  assert.deepEqual(sizes, [420, 404, 340, 220]);
  m.dispose(); m.el.remove();
  m = mount(() => h(U.NavSidebar, props));
  await tick();
  assert.equal(wrap().style.getPropertyValue("--hm-sb-w"), "220px", "width persists");
  grip().dispatchEvent(new Event("dblclick", { bubbles: true })); await tick();
  assert.equal(wrap().style.getPropertyValue("--hm-sb-w"), "300px", "double click → starting width");
  m.dispose(); m.el.remove();
  const off = mount(() => h(U.NavSidebar, { items: ITEMS, storageKey: "t.sb.rs2", hotkey: false }));
  await tick();
  assert.equal(off.el.querySelector(".hm-sb-resize"), null, "not resizable by default");
  off.dispose();
});

test("NavSidebar: navigating keeps the menu (same nodes, one mount, scroll position) and only moves the active row", async () => {
  localStorage.clear();
  R.createRouter({ routes: Object.fromEntries(["/", "/members", "/roles", "/payments", "/refunds", "/diamonds", "/support"].map((p) => [p, { component: () => null }])) });
  R.navigate("/"); await tick();
  let mounts = 0;
  const Counted = (p) => { mounts++; return h(U.NavSidebar, p); };
  const m = mount(() => h(Counted, { items: ITEMS, storageKey: "t.sb-keep", hotkey: false, defaultOpen: "all",
    featured: [{ id: "support", label: "Destek", href: "/support" }] }));
  await tick();
  const scroller = m.el.querySelector(".hm-sb-scroll");
  const cats = m.el.querySelector(".hm-sb-cats"), featured = m.el.querySelector(".hm-sb-featured");
  const refunds = m.el.querySelector('[data-where="group"][data-id="refunds"]');
  scroller.scrollTop = 300; // the user scrolled the menu
  const scrolls = [];
  scroller.scrollTo = (o) => scrolls.push(o);

  for (const p of ["/refunds", "/members", "/payments", "/support", "/refunds"]) {
    R.navigate(p); await tick();
    assert.equal(m.el.querySelector(".hm-sb-scroll"), scroller, `${p}: the scroll container is kept`);
    assert.equal(m.el.querySelector(".hm-sb-cats"), cats, `${p}: the categories are not rebuilt`);
    assert.equal(m.el.querySelector(".hm-sb-featured"), featured, `${p}: the featured list is not rebuilt`);
    assert.equal(scroller.scrollTop, 300, `${p}: the scroll position is kept`);
  }
  assert.equal(mounts, 1, "NavSidebar mounted once");
  assert.equal(m.el.querySelector('[data-where="group"][data-id="refunds"]'), refunds, "rows are the same nodes");
  assert.ok(refunds.classList.contains("is-active") && refunds.getAttribute("aria-current") === "page", "only the active state moves");
  assert.equal([...m.el.querySelectorAll(".hm-sb-item.is-active")].filter((r) => r.dataset.where !== "recent").length, 1);
  assert.deepEqual(scrolls, [], "a row already in view does not scroll the menu");

  // an active row below the visible area is brought into view (nearest edge), the menu alone scrolls
  const box = (top, height) => () => ({ x: 0, y: top, left: 0, top, right: 200, bottom: top + height, width: 200, height });
  scroller.getBoundingClientRect = box(0, 400);
  m.el.querySelector('[data-where="group"][data-id="diamonds"]').getBoundingClientRect = box(520, 40);
  R.navigate("/diamonds"); await tick();
  assert.equal(scrolls.length, 1);
  assert.equal(scrolls[0].top, 300 + 160, "scrolled by the overflow (block: nearest)");
  m.dispose();
});
