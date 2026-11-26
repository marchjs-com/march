import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { PieChart } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const rows = [{ label: "A", value: 50 }, { label: "B", value: 30 }, { label: "C", value: 20 }];

test("PieChart: one slice per row; the donut shows the total, center replaces it; live data", () => {
  const data = signal(rows);
  const [el, dispose] = mount(() => [h(PieChart, { data, donut: true, animate: false, width: 300, height: 200 }), h(PieChart, { data: rows, donut: 0.8, center: "Votes", width: 300, height: 200 })]);
  const [a, b] = el.querySelectorAll(".m-chart");
  assert.equal(a.querySelectorAll(".m-chart-slice").length, 3);
  assert.ok(a.querySelector(".m-chart-center").textContent.includes("100"));
  assert.equal(b.querySelector(".m-chart-center").textContent, "Votes");
  data.set(rows.slice(0, 2));
  assert.equal(a.querySelectorAll(".m-chart-slice").length, 2);
  dispose();
});

test("PieChart: a pie has no center; onSelect gets the slice and its share", () => {
  let got = null;
  const [el, dispose] = mount(() => h(PieChart, { data: rows, width: 300, height: 200, onSelect: (p) => { got = p; } }));
  assert.equal(el.querySelector(".m-chart-center"), null);
  el.querySelector(".m-chart-slice").dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(got?.label, "A");
  assert.equal(got?.share, 0.5);
  dispose();
});

test("PieChart: with animation a removed slice stays while it closes (marked leaving); labels show shares", () => {
  const data = signal(rows);
  const [el, dispose] = mount(() => h(PieChart, { data, labels: true, width: 300, height: 200 }));
  data.set(rows.slice(0, 2));
  assert.equal(el.querySelectorAll(".m-chart-slice").length, 3);
  assert.equal(el.querySelectorAll(".m-chart-slice.m-chart-leaving").length, 1);
  assert.ok(el.querySelector(".m-chart-slice-label"));
  dispose();
});
