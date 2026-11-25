// march/image/samples: demo photos drawn in code (no third-party images, no licence to track: they are March's own,
// MIT like the rest). Each scene is painted on a canvas with gradients, shapes and a little noise so filters, curves and
// histograms have real tones to work on: a landscape at golden hour, a portrait, a city at dusk, a breakfast table.
//   const c = samplePhoto("landscape", 1200, 800);   const url = samplePhotoUrl("portrait");
import { makeCanvas } from "./raster.ts";

/** The built-in scenes. */
export type SampleId = "landscape" | "portrait" | "city" | "food";
/** Ids with their English titles. */
export const SAMPLES: readonly { id: SampleId; title: string }[] = [
  { id: "landscape", title: "Golden hour" },
  { id: "portrait", title: "Portrait" },
  { id: "city", title: "City at dusk" },
  { id: "food", title: "Breakfast" },
];

type X = CanvasRenderingContext2D;
/** Deterministic random numbers (same picture every time). */
function rng(seed: number): () => number { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const lin = (x: X, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient => { const g = x.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) g.addColorStop(o, c); return g; };
const rad = (x: X, cx: number, cy: number, r0: number, r1: number, stops: [number, string][]): CanvasGradient => { const g = x.createRadialGradient(cx, cy, r0, cx, cy, r1); for (const [o, c] of stops) g.addColorStop(o, c); return g; };

function hills(x: X, w: number, h: number, base: number, amp: number, color: string | CanvasGradient, r: () => number, waves = 3): void {
  x.fillStyle = color;
  x.beginPath(); x.moveTo(0, h);
  const ph = r() * 6, f = 1 + r() * 2;
  for (let i = 0; i <= 64; i++) { const t = i / 64; let y = base; for (let k = 1; k <= waves; k++) y -= Math.sin(t * Math.PI * f * k + ph * k) * amp / k; x.lineTo(t * w, y * h); }
  x.lineTo(w, h); x.closePath(); x.fill();
}

function landscape(x: X, w: number, h: number): void {
  const r = rng(7);
  x.fillStyle = lin(x, 0, 0, 0, h, [[0, "#1d3b6b"], [0.38, "#e98a5b"], [0.55, "#f7c873"], [1, "#f7c873"]]);
  x.fillRect(0, 0, w, h);
  x.fillStyle = rad(x, w * 0.68, h * 0.5, 0, h * 0.5, [[0, "rgba(255,246,214,1)"], [0.08, "rgba(255,236,170,0.95)"], [0.3, "rgba(255,190,110,0.35)"], [1, "rgba(255,160,90,0)"]]);
  x.fillRect(0, 0, w, h);
  for (let i = 0; i < 5; i++) { x.fillStyle = `rgba(255,${200 + i * 8},${180 + i * 10},${0.18 + r() * 0.1})`; x.beginPath(); x.ellipse(w * r(), h * (0.12 + r() * 0.22), w * (0.12 + r() * 0.15), h * 0.025, 0, 0, Math.PI * 2); x.fill(); }
  hills(x, w, h, 0.6, 0.05, "#7c5a7d", r);
  hills(x, w, h, 0.68, 0.06, "#4b3f63", r);
  hills(x, w, h, 0.78, 0.05, lin(x, 0, h * 0.7, 0, h, [[0, "#2f5a3a"], [1, "#183222"]]), r);
  // a lake with the sun's reflection
  x.fillStyle = lin(x, 0, h * 0.84, 0, h, [[0, "#f2b77a"], [1, "#6b4b5e"]]); x.fillRect(0, h * 0.86, w, h * 0.14);
  x.fillStyle = "rgba(255,240,200,0.55)"; for (let i = 0; i < 9; i++) x.fillRect(w * 0.68 - (w * 0.06 * (1 - i / 9)), h * (0.87 + i * 0.013), w * 0.12 * (1 - i / 9), 2);
  // pines
  x.fillStyle = "#0f1f16";
  for (let i = 0; i < 26; i++) { const px = r() * w, py = h * (0.8 + r() * 0.06), s = h * (0.05 + r() * 0.07); x.beginPath(); x.moveTo(px, py - s); x.lineTo(px - s * 0.28, py); x.lineTo(px + s * 0.28, py); x.closePath(); x.fill(); }
}

function portrait(x: X, w: number, h: number): void {
  x.fillStyle = lin(x, 0, 0, w, h, [[0, "#2d6f73"], [1, "#16343f"]]); x.fillRect(0, 0, w, h);
  x.fillStyle = rad(x, w * 0.3, h * 0.25, 0, w * 0.6, [[0, "rgba(255,220,170,0.35)"], [1, "rgba(255,220,170,0)"]]); x.fillRect(0, 0, w, h);
  const cx = w / 2, s = Math.min(w, h);
  // shoulders
  x.fillStyle = lin(x, 0, h * 0.7, 0, h, [[0, "#d9533f"], [1, "#8f2e25"]]);
  x.beginPath(); x.ellipse(cx, h * 1.02, s * 0.42, s * 0.3, 0, Math.PI, 0); x.fill();
  // neck and face (warm skin with a light side)
  x.fillStyle = "#c98a64"; x.fillRect(cx - s * 0.07, h * 0.55, s * 0.14, s * 0.16);
  x.fillStyle = rad(x, cx - s * 0.06, h * 0.4, s * 0.02, s * 0.26, [[0, "#f3c59f"], [0.6, "#dba27a"], [1, "#a8694b"]]);
  x.beginPath(); x.ellipse(cx, h * 0.42, s * 0.17, s * 0.22, 0, 0, Math.PI * 2); x.fill();
  // hair
  x.fillStyle = "#2a1a14"; x.beginPath(); x.ellipse(cx, h * 0.3, s * 0.19, s * 0.13, 0, Math.PI, 0); x.fill();
  x.beginPath(); x.ellipse(cx + s * 0.15, h * 0.38, s * 0.05, s * 0.14, 0.2, 0, Math.PI * 2); x.fill();
  // eyes, smile, cheeks
  x.fillStyle = "#3b2418"; for (const d of [-1, 1]) { x.beginPath(); x.ellipse(cx + d * s * 0.065, h * 0.41, s * 0.016, s * 0.011, 0, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = "rgba(220,90,90,0.25)"; for (const d of [-1, 1]) { x.beginPath(); x.ellipse(cx + d * s * 0.1, h * 0.47, s * 0.035, s * 0.02, 0, 0, Math.PI * 2); x.fill(); }
  x.strokeStyle = "#8a3d33"; x.lineWidth = Math.max(1, s * 0.008); x.beginPath(); x.arc(cx, h * 0.49, s * 0.05, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke();
  // bokeh lights
  const r = rng(3);
  for (let i = 0; i < 14; i++) { const bx = r() * w, by = r() * h * 0.6, br = s * (0.02 + r() * 0.05); x.fillStyle = rad(x, bx, by, 0, br, [[0, `rgba(255,${200 + r() * 55},${120 + r() * 80},0.5)`], [1, "rgba(255,220,160,0)"]]); x.beginPath(); x.arc(bx, by, br, 0, Math.PI * 2); x.fill(); }
}

function city(x: X, w: number, h: number): void {
  const r = rng(11);
  x.fillStyle = lin(x, 0, 0, 0, h, [[0, "#0b1030"], [0.5, "#4a2a6b"], [0.75, "#d0607a"], [1, "#f2a65a"]]); x.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`; x.fillRect(r() * w, r() * h * 0.4, 1.5, 1.5); }
  for (let layer = 0; layer < 3; layer++) {
    let px = 0;
    const shade = ["#2a2347", "#1a1630", "#0d0b1c"][layer]!;
    while (px < w) {
      const bw = w * (0.04 + r() * 0.08), bh = h * (0.25 + r() * 0.35) * (1 - layer * 0.18), top = h - bh;
      x.fillStyle = shade; x.fillRect(px, top, bw, bh);
      if (layer === 2) for (let wy = top + 8; wy < h - 6; wy += 10) for (let wx = px + 4; wx < px + bw - 4; wx += 8) if (r() < 0.45) { x.fillStyle = r() < 0.8 ? "#ffd27a" : "#7ad7ff"; x.fillRect(wx, wy, 4, 5); }
      px += bw + 2;
    }
  }
  x.fillStyle = "rgba(255,150,120,0.18)"; x.fillRect(0, h * 0.92, w, h * 0.08);
}

function food(x: X, w: number, h: number): void {
  const r = rng(5);
  // wooden table
  x.fillStyle = lin(x, 0, 0, w, 0, [[0, "#8b5a3c"], [0.5, "#a06c47"], [1, "#7a4c31"]]); x.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(60,30,15,${0.08 + r() * 0.1})`; x.lineWidth = 1 + r() * 2; x.beginPath(); const y = r() * h; x.moveTo(0, y); x.bezierCurveTo(w * 0.3, y + 10 * r(), w * 0.6, y - 10 * r(), w, y + 6); x.stroke(); }
  const s = Math.min(w, h);
  const plate = (cx: number, cy: number, rr: number): void => { x.fillStyle = "rgba(0,0,0,0.25)"; x.beginPath(); x.ellipse(cx + rr * 0.06, cy + rr * 0.08, rr, rr, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = rad(x, cx, cy, rr * 0.2, rr, [[0, "#ffffff"], [0.85, "#eef1f4"], [1, "#c9ced6"]]); x.beginPath(); x.arc(cx, cy, rr, 0, Math.PI * 2); x.fill(); };
  plate(w * 0.42, h * 0.5, s * 0.3);
  // eggs, tomatoes, greens
  for (const [ex, ey] of [[0.36, 0.45], [0.47, 0.55]] as const) { x.fillStyle = "#fffaf0"; x.beginPath(); x.ellipse(w * ex, h * ey, s * 0.09, s * 0.075, 0.4, 0, Math.PI * 2); x.fill(); x.fillStyle = rad(x, w * ex - 3, h * ey - 3, 1, s * 0.035, [[0, "#ffd34d"], [1, "#f29b12"]]); x.beginPath(); x.arc(w * ex, h * ey, s * 0.035, 0, Math.PI * 2); x.fill(); }
  for (let i = 0; i < 5; i++) { const tx = w * (0.46 + r() * 0.12), ty = h * (0.36 + r() * 0.08); x.fillStyle = rad(x, tx - 2, ty - 2, 1, s * 0.03, [[0, "#ff6b5a"], [1, "#b81d18"]]); x.beginPath(); x.arc(tx, ty, s * 0.028, 0, Math.PI * 2); x.fill(); }
  for (let i = 0; i < 10; i++) { x.fillStyle = `hsl(${100 + r() * 30} 55% ${30 + r() * 20}%)`; x.beginPath(); x.ellipse(w * (0.3 + r() * 0.1), h * (0.58 + r() * 0.08), s * 0.03, s * 0.012, r() * 3, 0, Math.PI * 2); x.fill(); }
  // a cup of tea
  plate(w * 0.8, h * 0.28, s * 0.13);
  x.fillStyle = rad(x, w * 0.8, h * 0.28, 2, s * 0.09, [[0, "#c2410c"], [0.8, "#7c2d12"], [1, "#f5f5f4"]]); x.beginPath(); x.arc(w * 0.8, h * 0.28, s * 0.09, 0, Math.PI * 2); x.fill();
}

const PAINT: Record<SampleId, (x: X, w: number, h: number) => void> = { landscape, portrait, city, food };
const SIZE: Record<SampleId, [number, number]> = { landscape: [1200, 800], portrait: [800, 1000], city: [1200, 800], food: [1000, 1000] };

/** A demo photo on a new canvas (default sizes: landscape / city 1200×800, portrait 800×1000, food 1000×1000). */
export function samplePhoto(id: SampleId = "landscape", width?: number, height?: number): HTMLCanvasElement | OffscreenCanvas {
  const [dw, dh] = SIZE[id] ?? SIZE.landscape;
  const w = Math.round(width ?? (height ? (dw * height) / dh : dw)), h = Math.round(height ?? (width ? (dh * width) / dw : dh));
  const c = makeCanvas(w, h), x = c.getContext("2d") as X;
  (PAINT[id] ?? landscape)(x, w, h);
  // fine film noise so smooth gradients have real texture for sharpening, grain and the histogram
  const img = x.getImageData(0, 0, w, h), d = img.data, r = rng(99);
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 6; d[i] = d[i]! + n; d[i + 1] = d[i + 1]! + n; d[i + 2] = d[i + 2]! + n; }
  x.putImageData(img, 0, 0);
  return c;
}

/** A demo photo as a data: URL (JPEG), for `<Picture>` / `src` props. Cached per id and size. */
const urls = new Map<string, string>();
export function samplePhotoUrl(id: SampleId = "landscape", width?: number, height?: number): string {
  const key = `${id}:${width ?? ""}:${height ?? ""}`;
  let u = urls.get(key);
  if (!u) { const c = samplePhoto(id, width, height) as HTMLCanvasElement; u = c.toDataURL("image/jpeg", 0.9); urls.set(key, u); }
  return u;
}
