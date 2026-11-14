import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { mProps } = await import("../../../props/index.ts");
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { PeriodNav } = await import("./index.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("PeriodNav: previous / today / next, own texts; no today button without onToday", () => {
  const log = [];
  const [el, dispose] = mount(() => [
    h(PeriodNav, { onPrev: () => log.push("p"), onNext: () => log.push("n"), onToday: () => log.push("t"), labels: { group: "Month", previous: "Back", today: "Now", next: "On" } }),
    h(PeriodNav, { onPrev: () => {}, onNext: () => {} }),
  ]);
  const [a, b] = el.querySelectorAll("[role=group]");
  assert.equal(a.getAttribute("aria-label"), "Month");
  assert.ok(a.classList.contains("m-period-nav") && a.classList.contains("m-btn-group-attached"));
  const btns = [...a.querySelectorAll("button")];
  assert.deepEqual(btns.map((x) => x.getAttribute("aria-label") ?? x.textContent), ["Back", "Now", "On"]);
  for (const x of btns) x.click();
  assert.deepEqual(log, ["p", "t", "n"]);
  assert.equal(b.getAttribute("aria-label"), "Period");
  assert.deepEqual([...b.querySelectorAll("button")].map((x) => x.getAttribute("aria-label")), ["Previous", "Next"]);
  dispose();
});

test("PeriodNav: a title between the arrows (today follows), today off / own, arrows off, own icons, limits, colour, part classes", () => {
  const month = signal("March 2026"), atStart = signal(true);
  const [el, dispose] = mount(() => [
    mProps(h(PeriodNav, { title: month, onPrev: () => {}, onNext: () => {}, onToday: () => {}, today: "This month", prevIcon: "<", nextIcon: () => h("b", {}, ">"), prevDisabled: atStart, size: "sm", class: "mine", partClass: { prev: "my-prev", next: "my-next", today: "my-today", title: "my-title" } }), { color: "brand-orange" }),
    h(PeriodNav, { onPrev: () => {}, onNext: () => {}, onToday: () => {}, today: false }),
    h(PeriodNav, { onPrev: () => {}, onNext: () => {}, arrows: false }, "April"),
  ]);
  const [a, b, c] = el.querySelectorAll(".m-period-nav");
  assert.ok(a.classList.contains("is-titled") && a.classList.contains("mine") && !a.classList.contains("m-btn-group-attached"));
  assert.deepEqual([...a.children].map((x) => x.className.split(" ").find((k) => k.startsWith("my-"))), ["my-prev", "my-title", "my-next", "my-today"]);
  assert.equal(a.querySelector(".m-period-nav-title").textContent, "March 2026");
  month.set("April 2026");
  assert.equal(a.querySelector(".m-period-nav-title").textContent, "April 2026");
  assert.equal(a.querySelector(".my-prev").textContent, "<");
  assert.equal(a.querySelector(".my-next b").textContent, ">");
  assert.equal(a.querySelector(".my-today").textContent, "This month");
  assert.equal(a.querySelector(".my-prev").disabled, true);
  atStart.set(false);
  assert.equal(a.querySelector(".my-prev").disabled, false);
  assert.equal(a.querySelector(".my-next").closest("[data-m-color]")?.getAttribute("data-m-color"), "brand-orange");
  assert.ok(a.querySelector(".my-prev").classList.contains("m-btn-sm"));
  assert.equal(b.querySelectorAll("button").length, 2, "today off");
  assert.equal(c.querySelectorAll("button").length, 0, "arrows off");
  assert.equal(c.querySelector(".m-period-nav-title").textContent, "April");
  dispose();
});

test("PeriodNav: the chevrons swap in right-to-left", () => {
  const rtl = signal(false);
  const [el, dispose] = mount(() => h(PeriodNav, { rtl, onPrev: () => {}, onNext: () => {} }));
  const shapes = () => [...el.querySelectorAll("button")].map((b) => b.querySelector("svg").outerHTML);
  const [p0, n0] = shapes();
  assert.notEqual(p0, n0);
  rtl.set(true);
  const [p1, n1] = shapes();
  assert.equal(p1, n0);
  assert.equal(n1, p0);
  dispose();
});
