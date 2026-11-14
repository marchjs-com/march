// Charts benchmark: LineChart with 10,000 and 100,000 points (LTTB downsampling) in the tiny test DOM.
// Measures first render and a full data update (ms). Run directly: `node bench/charts.js`.
import { pathToFileURL } from "node:url";

const series = (n, phase = 0) => Array.from({ length: n }, (_, i) => ({ t: i, a: Math.sin(i / 500 + phase) * 100 + Math.random() * 10, b: Math.cos(i / 700 + phase) * 80 }));

/** @param {{installDom: Function}} deps @returns {Promise<{points: number, render: number, update: number, drawn: number}[]>} */
export async function run({ installDom }) {
  const { document, cleanup } = installDom();
  try {
    const { signal, h, render } = await import("../src/index.ts");
    const { LineChart } = await import("../src/charts/index.ts");
    const out = [];
    for (const n of [10_000, 100_000]) {
      const data = signal(series(n));
      const el = document.createElement("div");
      document.body.appendChild(el);
      let t = performance.now();
      const dispose = render(() => h(LineChart, { data, x: "t", y: ["a", "b"], width: 800, height: 300, title: `${n} points` }), el);
      const renderMs = performance.now() - t;
      const next = series(n, 1);
      t = performance.now();
      data.set(next);
      const updateMs = performance.now() - t;
      const drawn = el.querySelector("path.m-chart-line").getAttribute("d").split(/[ML]/).length - 1;
      out.push({ points: n, render: +renderMs.toFixed(1), update: +updateMs.toFixed(1), drawn });
      dispose();
      el.remove();
    }
    return out;
  } finally {
    cleanup();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { installDom } = await import("../src/testing/dom.ts");
  const rows = await run({ installDom });
  console.log("LineChart (2 series, LTTB, tiny DOM)");
  console.table(rows.map((r) => ({ points: r.points.toLocaleString("en"), "render ms": r.render, "update ms": r.update, "points drawn / series": r.drawn })));
}
