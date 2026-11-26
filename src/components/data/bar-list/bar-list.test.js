import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { BarList } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const labels = (el) => [...el.querySelectorAll(".m-barlist-label")].map((l) => l.textContent);
const rows = [{ label: "B", value: 20 }, { label: "A", value: 50 }, { label: "C", value: 5 }];

test("BarList: sorted largest first, a named list, live data", () => {
  const data = signal(rows);
  const [el, dispose] = mount(() => h(BarList, { data, title: "Top" }));
  const list = el.querySelector(".m-barlist");
  assert.equal(list.getAttribute("role"), "list");
  assert.equal(list.getAttribute("aria-label"), "Top");
  assert.deepEqual(labels(el), ["A", "B", "C"]);
  data.set([...rows, { label: "D", value: 99 }]);
  assert.deepEqual(labels(el), ["D", "A", "B", "C"]);
  dispose();
});

test("BarList: sort={false}, limit, x / y keys; onSelect makes buttons with the rank", () => {
  let got = null;
  const songs = [{ t: "x", n: 1 }, { t: "y", n: 3 }, { t: "z", n: 2 }];
  const [el, dispose] = mount(() => [h(BarList, { data: songs, x: "t", y: "n", sort: false, limit: 2 }), h(BarList, { data: rows, onSelect: (r) => { got = r; } })]);
  const [a, b] = el.querySelectorAll(".m-barlist");
  assert.deepEqual([...a.querySelectorAll(".m-barlist-label")].map((l) => l.textContent), ["x", "y"]);
  assert.equal(a.querySelector("button"), null);
  b.querySelector("button.m-barlist-row").dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(got?.label, "A");
  assert.equal(got?.rank, 1);
  dispose();
});

const { manualClock, step } = await import("../../../motion/engine/clock.ts");
const run = (ms = 2000) => { for (let i = 0; i < ms / 16; i++) step(16); };
const widths = (el) => [...el.querySelectorAll(".m-barlist-fill")].map((r) => r.getAttribute("width"));

test("BarList: animate false draws final widths; a removed row goes at once", () => {
  const data = signal(rows);
  const [el, dispose] = mount(() => h(BarList, { data, animate: false }));
  assert.deepEqual(widths(el), ["100%", "40%", "10%"]);
  data.set(rows.slice(0, 2));
  assert.deepEqual(labels(el), ["A", "B"]);
  dispose();
});

test("BarList: bars grow in with stagger, widths morph, reordered rows glide, removed rows shrink before they go", () => {
  manualClock(true);
  try {
    const data = signal(rows);
    const [el, dispose] = mount(() => h(BarList, { data, animate: { easing: "out", duration: 300, stagger: 100 } }));
    assert.deepEqual(widths(el), ["0%", "0%", "0%"], "bars start empty");
    step(16); step(16); step(16); step(16); step(16); step(16);
    const [a, , c] = widths(el).map(parseFloat);
    assert.ok(a > 0 && c === 0, "the first bar grows before the last one starts (stagger)");
    run();
    assert.deepEqual(widths(el), ["100%", "40%", "10%"]);
    // C overtakes everyone: it moves to the top and glides there from below; B leaves
    data.set([{ label: "A", value: 50 }, { label: "C", value: 80 }]);
    assert.deepEqual(labels(el), ["C", "B", "A"], "the leaving row stays in its old place while it shrinks");
    step(16); step(16);
    const top = el.querySelector(".m-barlist-item");
    assert.match(top.style.getPropertyValue("transform"), /translateY\(\d/, "the new top row starts below and glides up");
    const leaving = el.querySelector(".m-barlist-item.is-leaving");
    assert.equal(leaving.getAttribute("aria-hidden"), "true");
    run();
    assert.deepEqual(labels(el), ["C", "A"]);
    assert.equal(top.style.getPropertyValue("transform"), "");
    assert.deepEqual(widths(el), ["100%", "62.5%"]);
    dispose();
  } finally { manualClock(false); }
});
