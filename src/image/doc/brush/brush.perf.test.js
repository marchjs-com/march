// Brush performance: a 4096×2304 document, a 200-sample stroke with a 60 px soft brush. Prints ms per segment
// (pointer move → dabs → composite → write). Target: < 8 ms per segment. Run: node --expose-gc --test <this file>.
import { test } from "node:test";
import assert from "node:assert/strict";
const D = await import("../index.ts");
const E = await import("./engine.ts");
const P = await import("./presets.ts");

function run(label, settings, samples = 200) {
  const doc = new D.ImageDocument({ width: 4096, height: 2304, background: "white" });
  const layer = doc.newPixelLayer("Paint");
  doc.change("New Layer", () => doc.add(layer));
  // collect the document's setup garbage (the 150 MB background fill buffer) before timing: run with --expose-gc
  globalThis.gc?.();
  doc.begin("Brush");
  const s = new E.BrushStroke(new E.PaintSurface(doc, layer), { preset: P.findBrush("soft-round"), size: 60, fg: [0.2, 0.3, 0.9, 1], seed: 1, ...settings });
  // a wavy stroke across the canvas (~20 px between samples, like a fast hand at 120 Hz)
  const pts = Array.from({ length: samples }, (_, i) => ({ x: 100 + i * 19, y: 1152 + Math.sin(i / 9) * 600, pressure: 0.5 + 0.5 * Math.sin(i / 13) ** 2, pointerType: "pen" }));
  s.begin(pts[0]);
  const times = [];
  for (let i = 1; i < pts.length; i++) { const t = performance.now(); s.move(pts[i]); times.push(performance.now() - t); }
  s.end();
  doc.commit();
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const r = { mean, median: times[times.length >> 1], p95: times[Math.floor(times.length * 0.95)], max: times[times.length - 1] };
  console.log(`${label}: mean ${r.mean.toFixed(2)} ms, median ${r.median.toFixed(2)} ms, p95 ${r.p95.toFixed(2)} ms, max ${r.max.toFixed(2)} ms per segment`);
  return r;
}

test("perf: 4096×2304, 200-sample stroke, 60 px soft brush", () => {
  run("warm-up", {}, 60);
  const r = run("soft round 60 px", {});
  run("soft round 60 px, pressure size + texture", { pressureSize: true, preset: { ...P.findBrush("soft-round"), texture: { pattern: "noise", depth: 0.5 } } });
  run("soft round 60 px, mandala 8 (16 copies)", { symmetry: { type: "mandala", cx: 2048, cy: 1152, segments: 8 } });
  assert.ok(r.median < 8, `median ${r.median} ms per segment`);
});
