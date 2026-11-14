import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
const { Scheduler } = await import("./index.ts");
const D = await import("../../../core/date.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const key = (el, k, o = {}) => el.dispatchEvent(new Event("keydown", { bubbles: true, cancelable: true, key: k, ...o }));
const evs = () => [
  { id: "a", title: "Planning", start: "2026-11-10T09:00", end: "2026-11-10T10:30", color: "brand-blue" },
  { id: "b", title: "Review", start: "2026-11-10T10:00", end: "2026-11-10T11:00" },
  { id: "c", title: "Offsite", start: "2026-11-11", end: "2026-11-13", allDay: true },
];

test("core date: grids, weeks, date-times roll over, Intl names", () => {
  assert.equal(D.startOfWeek("2026-11-12", 1), "2026-11-09");
  assert.equal(D.startOfWeek("2026-11-12", 0), "2026-11-08");
  const g = D.monthGrid("2026-11-12", 1);
  assert.equal(g.length, 42);
  assert.equal(g[0], "2026-10-26");
  assert.deepEqual(D.splitDateTime("2026-11-12T09:45"), { date: "2026-11-12", minutes: 585 });
  assert.equal(D.joinDateTime("2026-11-12", 1500), "2026-11-13T01:00");
  assert.equal(D.joinDateTime("2026-11-12", -30), "2026-11-11T23:30");
  assert.equal(D.diffDays("2026-11-12", "2026-12-01"), 19);
  assert.equal(D.snapMinutes(37, 15), 30);
  assert.deepEqual(D.weekdayNames("en", 1, "short").slice(0, 2), ["Mon", "Tue"]);
  assert.equal(D.formatMinutes(13 * 60 + 5, "en", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }), "13:05");
});

test("Scheduler week view: day columns, overlapping blocks share the width, all-day bar spans days", () => {
  locale.set("en-GB");
  const m = mount(() => h(Scheduler, { events: evs(), date: "2026-11-12", view: "week" }));
  const cols = m.el.querySelectorAll(".m-sch-col");
  assert.equal(cols.length, 7);
  assert.equal(cols[0].dataset.day, "2026-11-09"); // en-GB weeks start on Monday
  const blocks = [...m.el.querySelectorAll(".m-sch-block")];
  assert.equal(blocks.length, 2);
  assert.ok(blocks.every((b) => b.style.getPropertyValue("width").includes("50%")), "two overlapping events → half width each");
  const bar = m.el.querySelector(".m-sch-allday-grid .m-sch-bar");
  assert.equal(bar.style.getPropertyValue("grid-column").replace(/\s/g, ""), "3/6");
  assert.match(bar.getAttribute("aria-label"), /Offsite/);
  assert.match(m.el.querySelector(".m-sch-title").textContent, /November/);
  m.dispose();
});

test("Scheduler: keyboard move / resize snaps to step and reports onChange; Next / view switch", () => {
  locale.set("en-GB");
  const changes = [];
  const m = mount(() => h(Scheduler, { events: evs(), date: "2026-11-12", view: "week", step: 30, onChange: (e, r) => changes.push([e.id, r.start, r.end]) }));
  const a = () => [...m.el.querySelectorAll(".m-sch-ev")].find((x) => x.dataset.ev === "a");
  key(a(), "ArrowDown", { altKey: true });
  assert.deepEqual(changes.at(-1), ["a", "2026-11-10T09:30", "2026-11-10T11:00"]);
  key(a(), "ArrowRight", { altKey: true });
  assert.deepEqual(changes.at(-1), ["a", "2026-11-11T09:30", "2026-11-11T11:00"]);
  key(a(), "ArrowDown", { altKey: true, shiftKey: true });
  assert.deepEqual(changes.at(-1), ["a", "2026-11-11T09:30", "2026-11-11T11:30"]);
  // all-day: Alt+→ shifts the whole range by a day
  const c = [...m.el.querySelectorAll(".m-sch-ev")].find((x) => x.dataset.ev === "c");
  key(c, "ArrowRight", { altKey: true });
  assert.deepEqual(changes.at(-1), ["c", "2026-11-12", "2026-11-14"]);
  // next week, then month view
  [...m.el.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Next").click();
  assert.equal(m.el.querySelector(".m-sch-col").dataset.day, "2026-11-16");
  [...m.el.querySelectorAll(".m-segment")].find((b) => b.textContent === "Month").click();
  assert.equal(m.el.querySelectorAll(".m-sch-day").length, 42);
  m.dispose();
});

test("Scheduler month view: bars in lanes, +N more, arrow keys move the day focus", () => {
  locale.set("en-GB");
  const many = Array.from({ length: 5 }, (_, i) => ({ id: `m${i}`, title: `Item ${i}`, start: "2026-11-04T09:00", end: "2026-11-04T10:00" }));
  const m = mount(() => h(Scheduler, { events: [...evs(), ...many], date: "2026-11-12", view: "month" }));
  const day = m.el.querySelector('[data-day="2026-11-04"]');
  assert.match(day.querySelector(".m-sch-more").textContent, /\+2/);
  const focus = m.el.querySelector('.m-sch-daynum[tabindex="0"]');
  assert.equal(focus.dataset.focus, "2026-11-12");
  key(focus, "ArrowRight");
  assert.equal(m.el.querySelector('.m-sch-daynum[tabindex="0"]').dataset.focus, "2026-11-13");
  m.dispose();
});

test("Scheduler: own texts, parts off (toolbar, today, views, now line, hint), own event content", () => {
  locale.set("en-GB");
  const base = { events: evs(), date: "2026-11-12", view: "week" };
  const m = mount(() => [
    h(Scheduler, { ...base, labels: { allDay: "Whole day", today: "Now", week: "7 days" }, renderEvent: (e, i) => h("i", { class: "own-ev" }, `${e.title} @ ${i.time}`), help: "hint!" }),
    h(Scheduler, { ...base, todayButton: false, views: ["week", "day"], help: false, nowLine: false, animate: false }),
    h(Scheduler, { ...base, toolbar: false, class: "mine" }),
    h(Scheduler, { ...base, views: false }),
  ]);
  const [a, b, c, d] = m.el.querySelectorAll(".m-sch");
  const texts = (el, sel) => [...el.querySelectorAll(sel)].map((x) => x.textContent);
  assert.equal(a.querySelector(".m-sch-allday-label").textContent, "Whole day");
  assert.ok(texts(a, ".m-sch-toolbar button").includes("Now"));
  assert.ok(texts(a, ".m-segment").includes("7 days"));
  assert.match(a.querySelector(".m-sch-block .own-ev").textContent, /Planning @ /);
  assert.equal(a.querySelector(".m-sch-ev-title"), null);
  assert.equal(a.querySelector(".m-sch-help").textContent, "hint!");
  assert.ok(!texts(b, ".m-sch-toolbar button").includes("Today"));
  assert.deepEqual(texts(b, ".m-segment"), ["Week", "Day"]);
  assert.equal(b.querySelector(".m-sch-help"), null);
  assert.equal(b.getAttribute("aria-describedby"), null);
  assert.equal(c.querySelector(".m-sch-toolbar"), null);
  assert.ok(c.className.includes("mine"));
  assert.ok(d.querySelector(".m-sch-toolbar") && !d.querySelector(".m-segment"));
  m.dispose();
});
