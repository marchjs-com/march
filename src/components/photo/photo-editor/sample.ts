// A sample document drawn in code (no third-party photo): a dusk landscape (sky gradient, sun with glow, layered
// hills, a lake with the reflection, stars) as separate layers, plus a title text area, so every tool has something
// to work on. Made here; free to use under March's licence (MIT).

import { ImageDocument, type RGBA } from "../../../image/doc/index.ts";

const mix = (a: RGBA, b: RGBA, t: number): RGBA => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
const hash = (x: number, y: number): number => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const smooth = (t: number): number => t * t * (3 - 2 * t);
/** 1-D value noise, octaves. */
function noise(x: number, seed: number): number {
  let v = 0, a = 0.5, f = 1;
  for (let o = 0; o < 4; o++) {
    const i = Math.floor(x * f), t = smooth(x * f - i);
    v += a * ((hash(i, seed + o) * (1 - t) + hash(i + 1, seed + o) * t) - 0.5);
    a *= 0.5; f *= 2.1;
  }
  return v;
}

/** The sample document (default 1600 × 1000). */
export function samplePhoto(width = 1600, height = 1000): ImageDocument {
  const doc = new ImageDocument({ width, height, name: "Dusk", background: "transparent", dpi: 144 });
  const W = width, H = height, horizon = Math.round(H * 0.62);
  const layer = (name: string, paint: (px: Float32Array) => void, extra: Partial<{ blend: import("../../../image/doc/index.ts").BlendMode; opacity: number }> = {}): void => {
    const l = doc.newPixelLayer(name);
    const px = new Float32Array(W * H * 4);
    paint(px);
    l.raster.write(0, 0, W, H, px);
    if (extra.blend) l.blend = extra.blend;
    if (extra.opacity != null) l.opacity = extra.opacity;
    doc.layers.push(l);
  };
  // sky: deep blue → violet → warm orange at the horizon
  const skyStops: [number, RGBA][] = [[0, [0.06, 0.09, 0.25, 1]], [0.45, [0.36, 0.22, 0.52, 1]], [0.8, [0.96, 0.46, 0.33, 1]], [1, [1, 0.74, 0.42, 1]]];
  const sky = (t: number): RGBA => { for (let i = 0; i < skyStops.length - 1; i++) { const [a, ca] = skyStops[i]!, [b, cb] = skyStops[i + 1]!; if (t <= b) return mix(ca, cb, (t - a) / (b - a)); } return skyStops[skyStops.length - 1]![1]; };
  const sunX = W * 0.68, sunY = horizon - H * 0.08, sunR = Math.min(W, H) * 0.075;
  layer("Sky", (px) => {
    for (let y = 0; y < H; y++) {
      const c = sky(Math.min(1, y / horizon));
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4, d = Math.hypot(x - sunX, y - sunY);
        const glow = Math.exp(-Math.pow(d / (sunR * 4), 2)) * 0.55;
        px[i] = Math.min(1, c[0] + glow); px[i + 1] = Math.min(1, c[1] + glow * 0.7); px[i + 2] = Math.min(1, c[2] + glow * 0.35); px[i + 3] = 1;
      }
    }
  });
  layer("Stars", (px) => {
    for (let k = 0; k < 420; k++) {
      const x = Math.floor(hash(k, 1) * W), y = Math.floor(hash(k, 2) * horizon * 0.6), b = 0.4 + hash(k, 3) * 0.6;
      const i = (y * W + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = 1; px[i + 3] = b * (1 - y / (horizon * 0.6));
    }
  }, { blend: "screen" });
  layer("Sun", (px) => {
    for (let y = Math.floor(sunY - sunR - 2); y <= sunY + sunR + 2; y++) for (let x = Math.floor(sunX - sunR - 2); x <= sunX + sunR + 2; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const d = Math.hypot(x - sunX, y - sunY), a = Math.max(0, Math.min(1, sunR - d + 0.5));
      const i = (y * W + x) * 4;
      px[i] = 1; px[i + 1] = 0.9 - (y - sunY + sunR) / (sunR * 2) * 0.25; px[i + 2] = 0.62; px[i + 3] = a;
    }
  });
  const hills: [string, RGBA, number, number, number][] = [
    ["Far hills", [0.42, 0.25, 0.45, 1], 0.06, 0.0018, 11],
    ["Hills", [0.24, 0.15, 0.33, 1], 0.11, 0.0026, 23],
    ["Near hills", [0.11, 0.08, 0.18, 1], 0.17, 0.0034, 37],
  ];
  hills.forEach(([name, color, amp, freq, seed], k) => layer(name, (px) => {
    for (let x = 0; x < W; x++) {
      const top = horizon - H * amp * (0.6 + noise(x * freq, seed) * 1.6) + k * H * 0.025;
      for (let y = Math.max(0, Math.floor(top)); y < horizon; y++) {
        const i = (y * W + x) * 4, a = Math.min(1, y - top + 1);
        const shade = 1 - (y - top) / (horizon - top + 1) * 0.25;
        px[i] = color[0] * shade; px[i + 1] = color[1] * shade; px[i + 2] = color[2] * shade; px[i + 3] = a;
      }
    }
  }));
  layer("Lake", (px) => {
    for (let y = horizon; y < H; y++) {
      const t = (y - horizon) / (H - horizon);
      const mirrorY = Math.max(0, horizon - (y - horizon) * 0.9);
      const c = mix(sky(mirrorY / horizon), [0.04, 0.05, 0.12, 1], 0.35 + t * 0.5);
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const ripple = Math.sin((y - horizon) * 0.35 + noise(x * 0.01, 5) * 6) * 0.03 * (1 - t);
        const sunPath = Math.exp(-Math.pow((x - sunX) / (sunR * (1.2 + t * 2)), 2)) * (0.5 - t * 0.4) * (0.6 + 0.4 * Math.sin(y * 0.7 + hash(x >> 3, y) * 3));
        px[i] = Math.min(1, c[0] + ripple + sunPath); px[i + 1] = Math.min(1, c[1] + ripple + sunPath * 0.75); px[i + 2] = Math.min(1, c[2] + ripple + sunPath * 0.4); px[i + 3] = 1;
      }
    }
  });
  const l = doc.layers[doc.layers.length - 1]!;
  doc.activeId = l.id;
  doc.selected = [l.id];
  doc.dirtySinceSave = false;
  doc.history.clear();
  return doc;
}
