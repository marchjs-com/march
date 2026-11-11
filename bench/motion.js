#!/usr/bin/env node
// Motion benchmark (tiny DOM): FLIP-reordering 1,000 keyed rows and stepping 1,000 springs to rest.
import { fileURLToPath } from "node:url";
export async function run({ installDom }) {
  installDom();
  const { signal, h, render, For, lazy, createRoot } = await import("../src/index.ts");
  const M = await import("../src/motion/index.ts");
  const ms = (fn) => { const t = performance.now(); fn(); return performance.now() - t; };
  const items = signal(Array.from({ length: 1000 }, (_, i) => i));
  const el = document.createElement("ul");
  render(() => h(For, { each: items, animate: true }, lazy(() => [(x) => h("li", {}, () => String(x()))])), el);
  const flip = ms(() => items.set([...items.peek()].reverse()));
  const target = signal(0);
  let springs = [];
  createRoot(() => { springs = Array.from({ length: 1000 }, () => M.spring(() => target(), { stiffness: 400, damping: 40 })); });
  const t0 = performance.now();
  target.set(100);
  while (springs.some((s) => s.moving())) await new Promise((r) => setTimeout(r, 4));
  const settle = performance.now() - t0;
  console.log("motion        FLIP 1k rows   1k springs to rest");
  console.log(`              ${flip.toFixed(1).padStart(8)}ms   ${settle.toFixed(0).padStart(10)}ms`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { installDom } = await import("../src/testing/dom.ts");
  await run({ installDom });
}
