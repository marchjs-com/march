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
