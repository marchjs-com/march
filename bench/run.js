#!/usr/bin/env node
// March benchmarks (node, tiny DOM — relative numbers, not browser frame times):
//   list: create 1k/10k keyed rows, update every 10th row, swap two rows, replace all, clear
//   + table and charts scenarios when those modules are present.
// Usage: node bench/run.js [--rows 1000,10000]
import { installDom } from "../src/testing/dom.ts";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const sizes = String(arg("--rows", "1000,10000")).split(",").map(Number);
installDom();
const { signal, h, render, For, lazy, batch } = await import("../src/index.js");

const ms = (fn) => { const t = performance.now(); fn(); return performance.now() - t; };
const row = (i, v = 0) => ({ id: i, label: `row ${i}`, v });

function listBench(n) {
  const items = signal(Array.from({ length: n }, (_, i) => row(i)));
  const el = document.createElement("table");
  let dispose;
  const create = ms(() => {
    dispose = render(() => h("tbody", {}, h(For, { each: items, key: "id" }, lazy(() => [(r) => h("tr", {}, h("td", {}, () => r().id), h("td", {}, () => r().label), h("td", {}, () => r().v))]))), el);
  });
  const update = ms(() => items.set(items.peek().map((r, i) => (i % 10 === 0 ? { ...r, v: r.v + 1 } : r))));
  const swap = ms(() => { const a = [...items.peek()]; [a[1], a[n - 2]] = [a[n - 2], a[1]]; items.set(a); });
  const replace = ms(() => items.set(Array.from({ length: n }, (_, i) => row(i + n))));
  const clear = ms(() => batch(() => items.set([])));
  const ok = el.querySelectorAll("tr").length === 0;
  dispose();
  return { create, update, swap, replace, clear, ok };
}

console.log(`March list benchmark (tiny DOM, node ${process.version})`);
console.log("rows      create   update10%   swap   replace   clear");
for (const n of sizes) {
  const r = listBench(n);
  const f = (x) => `${x.toFixed(1)}ms`.padStart(9);
  console.log(`${String(n).padEnd(8)}${f(r.create)}${f(r.update)}  ${f(r.swap)}${f(r.replace)}${f(r.clear)}${r.ok ? "" : "  (!)"}`);
}

for (const mod of ["./table.js", "./charts.js"]) {
  try { const m = await import(mod); if (m.run) { console.log(""); await m.run({ installDom }); } } catch (e) { if (e.code !== "ERR_MODULE_NOT_FOUND") throw e; }
}
