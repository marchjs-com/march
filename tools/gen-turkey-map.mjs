// Natural Earth admin-1 (public domain) → Turkey's 81 provinces as SVG paths (equirectangular, cos 39° x scale), DP-simplified.
import { readFileSync, writeFileSync } from "node:fs";
const [src, out, tolArg] = process.argv.slice(2);
const tol = Number(tolArg ?? 0.7);
const g = JSON.parse(readFileSync(src, "utf8"));
const tr = g.features.filter((f) => f.properties.adm0_a3 === "TUR");
const K = Math.cos((39 * Math.PI) / 180);
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (const f of tr) for (const p of (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates)) for (const [lon, lat] of p[0]) {
  const x = lon * K, y = -lat; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
}
const W = 1000, S = W / (maxX - minX), H = Math.ceil((maxY - minY) * S);
const proj = ([lon, lat]) => [(lon * K - minX) * S, (-lat - minY) * S];
function dp(pts, eps) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let best = -1, bi = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L; if (d > best) { best = d; bi = i; } }
    if (best > eps) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const area = (r) => { let s = 0; for (let i = 0; i < r.length; i++) { const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length]; s += x1 * y2 - x2 * y1; } return s / 2; };
const centroid = (r) => { let a = 0, cx = 0, cy = 0; for (let i = 0; i < r.length; i++) { const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length]; const c = x1 * y2 - x2 * y1; a += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c; } return [cx / (3 * a), cy / (3 * a)]; };
const r1 = (v) => Math.round(v * 10) / 10;
let total = 0;
const provs = tr.map((f) => {
  const p = f.properties, polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  let d = "", big = null, bigA = 0;
  for (const poly of polys) {
    const ring = poly[0].map(proj), a = Math.abs(area(ring));
    if (a > bigA) { bigA = a; big = ring; }
    if (a < 4 && polys.length > 1) continue; // drop specks
    const open = ring.slice(0, -1); let far = 0, fd = -1;
    open.forEach(([x, y], i) => { const d = Math.hypot(x - open[0][0], y - open[0][1]); if (d > fd) { fd = d; far = i; } });
    const s = [...dp(open.slice(0, far + 1), tol), ...dp([...open.slice(far), open[0]], tol).slice(1)];
    if (s.length < 4) continue;
    total += s.length;
    const q = s.slice(0, -1).map(([x, y]) => [Math.round(x * 2) / 2, Math.round(y * 2) / 2]);
    d += `M${q[0][0]} ${q[0][1]}l` + q.slice(1).map(([x, y], i) => { const dx = x - q[i][0], dy = y - q[i][1]; return `${dx}${dy < 0 ? "" : " "}${dy}`; }).join(" ").replace(/ -/g, "-") + "z";
    if (a > bigA) { bigA = a; big = ring; }
  }
  const [cx, cy] = centroid(big);
  return { id: p.iso_3166_2, code: Number(p.iso_3166_2.slice(3)), name: p.name_tr || p.name, cx: Math.round(cx), cy: Math.round(cy), d };
}).sort((a, b) => a.code - b.code);
const body = `// Turkey's 81 provinces (il) for ChoroplethMap: plate code, ISO 3166-2 id, Turkish name, SVG path and a label point.
// GENERATED from Natural Earth admin-1 (public domain, naturalearthdata.com), equirectangular, simplified; do not edit.
// viewBox 0 0 ${W} ${H}.
export interface Province { id: string; code: number; name: string; d: string; cx: number; cy: number }
export const TURKEY_VIEWBOX: readonly [number, number] = [${W}, ${H}];
export const TURKEY: readonly Province[] = [
${provs.map((p) => `  { id: "${p.id}", code: ${p.code}, name: "${p.name}", cx: ${p.cx}, cy: ${p.cy}, d: "${p.d}" },`).join("\n")}
];
`;
writeFileSync(out, body.replace(/\r\n/g, "\n"));
console.log(`provinces ${provs.length}, points ${total}, bytes ${body.length}, H ${H}`);
