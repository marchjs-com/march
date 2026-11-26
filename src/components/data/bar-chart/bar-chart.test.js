import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { BarChart } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const rows = [{ day: "Mon", a: 3, b: 1 }, { day: "Tue", a: 5, b: 2 }, { day: "Wed", a: 4, b: 6 }];

test("BarChart: one bar per row and series; the title and the data table follow live data", () => {
  const data = signal(rows);
  const [el, dispose] = mount(() => h(BarChart, { data, x: "day", y: ["a", "b"], title: "Sales", width: 300 }));
  assert.equal(el.querySelectorAll(".m-chart-bar").length, 6);
  assert.equal(el.querySelector("svg title").textContent, "Sales");
  data.set(rows.slice(0, 2));
  assert.equal(el.querySelectorAll(".m-chart-bar").length, 4);
  assert.equal(el.querySelectorAll("table tbody tr").length, 2);
  dispose();
});

test("BarChart: horizontal and stacked draw the same bars; onSelect gets the bar", () => {
  let got = null;
  const [el, dispose] = mount(() => h(BarChart, { data: rows, x: "day", y: ["a", "b"], stacked: true, horizontal: true, width: 300, onSelect: (p) => { got = p; } }));
  assert.equal(el.querySelectorAll(".m-chart-bar").length, 6);
  el.querySelector(".m-chart-bar").dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(got?.x, "Mon");
  dispose();
});

test("BarChart: value labels, reference marks; a removed category sinks before it goes (animate off: at once)", () => {
  const data = signal(rows);
  const [el, dispose] = mount(() => [h(BarChart, { data, x: "day", y: "a", labels: true, marks: [{ y: 4, label: "Target" }, { y: "average" }], animate: { enter: false }, width: 300, class: "anim" }),
    h(BarChart, { data, x: "day", y: "a", animate: false, width: 300, class: "still" })]);
  assert.deepEqual([...el.querySelectorAll(".anim .m-chart-value")].map((t) => t.textContent), ["3", "5", "4"]);
  assert.ok(el.querySelector(".anim .m-chart-ref-h"));
  assert.ok(el.textContent.includes("Target") && el.textContent.includes("Average"));
  data.set(rows.slice(0, 2));
  assert.equal(el.querySelectorAll(".still .m-chart-bar").length, 2);
  assert.equal(el.querySelectorAll(".anim .m-chart-bar").length, 3);
  assert.equal(el.querySelectorAll(".anim .m-chart-bar.m-chart-leaving").length, 1);
  dispose();
});
