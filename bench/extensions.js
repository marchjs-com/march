#!/usr/bin/env node
// Extension pipeline cost (node, tiny DOM — relative numbers): create N components with nothing registered (the fast
// path: createComponent as before), then with 1, 5 and 20 extensions that match, and 20 that target other components.
// Usage: node bench/extensions.js [--n 10000] [--runs 5]
import { installDom } from "../src/testing/dom.ts";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d; };

/** Median ms to create `n` components per case. */
export async function extensionBench(n = 10000, runs = 5) {
  if (!globalThis.document) installDom();
  const { h, render, extend, intercept } = await import("../src/index.ts");
  function Item(p) { return h("i", { class: p.cls }, p.label); }
  function Other() { return null; }
  const time = () => {
    const out = [];
    for (let r = 0; r < runs; r++) {
      const host = document.createElement("div");
      const t = performance.now();
      const dispose = render(() => { const a = new Array(n); for (let i = 0; i < n; i++) a[i] = h(Item, { label: "x", cls: "c" }); return a; }, host);
      out.push(performance.now() - t);
      dispose();
    }
    return out.sort((a, b) => a - b)[runs >> 1];
  };
  const result = { none: time() };
  const cases = [["one", 1, Item], ["five", 5, Item], ["twenty", 20, Item], ["twentyOther", 20, Other]];
  for (const [name, count, target] of cases) {
    const offs = [];
    for (let i = 0; i < count; i++) {
      offs.push(i % 2
        ? intercept(target, { name: `p${i}`, props: (p) => ({ cls: p.cls }) })
        : extend(target, { name: `s${i}`, props: { [`x${i}`]: { type: "string" } }, setup() {} }));
    }
    result[name] = time();
    for (const o of offs) o();
  }
  result.after = time();
  return result;
}

if (process.argv[1] && import.meta.url.endsWith("/bench/extensions.js") && process.argv[1].endsWith("extensions.js")) {
  const r = await extensionBench(arg("--n", 10000), arg("--runs", 5));
  for (const [k, v] of Object.entries(r)) console.log(k.padEnd(12), `${v.toFixed(1)} ms`, `×${(v / r.none).toFixed(2)}`);
}
