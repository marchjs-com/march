// 3D lookup tables: a run of colour ops becomes one table (N³ RGB entries, indexed by the sRGB-encoded input, holding
// linear output), applied with trilinear interpolation on the CPU or as a 3D texture on the GPU. Also .cube files.
import { encodeTableF, toLinear, type Raster } from "./raster.ts";

/** A 3D LUT: size N, data N³ × 3 floats (linear RGB), red fastest (the .cube order). */
export interface Lut3D { size: number; data: Float32Array; title?: string | undefined }

/** Build a LUT by running `fn` on every grid colour (linear RGB in, in place). */
export function buildLut(fn: (rgb: Float32Array) => void, size = 33): Lut3D {
  const data = new Float32Array(size * size * size * 3), px = new Float32Array(3), M = size - 1;
  const lin = new Float32Array(size);
  for (let i = 0; i < size; i++) lin[i] = toLinear(i / M);
  let o = 0;
  for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) {
    px[0] = lin[r]!; px[1] = lin[g]!; px[2] = lin[b]!;
    fn(px);
    data[o++] = px[0]; data[o++] = px[1]; data[o++] = px[2];
  }
  return { size, data };
}

/** Apply a LUT to a raster in place (rows y0..y1 when given: tiled work). */
export function applyLut(r: Raster, lut: Lut3D, y0 = 0, y1 = r.height): void {
  const enc = encodeTableF(), E = enc.length - 1, N = lut.size, M = N - 1, L = lut.data, d = r.data, N2 = N * N;
  const end = y1 * r.width * 4;
  for (let i = y0 * r.width * 4; i < end; i += 4) {
    const cr = d[i]!, cg = d[i + 1]!, cb = d[i + 2]!;
    const fr = enc[cr <= 0 ? 0 : cr >= 1 ? E : (cr * E + 0.5) | 0]! * M, fg = enc[cg <= 0 ? 0 : cg >= 1 ? E : (cg * E + 0.5) | 0]! * M, fb = enc[cb <= 0 ? 0 : cb >= 1 ? E : (cb * E + 0.5) | 0]! * M;
    const r0 = fr | 0, g0 = fg | 0, b0 = fb | 0, r1 = r0 < M ? r0 + 1 : M, g1 = g0 < M ? g0 + 1 : M, b1 = b0 < M ? b0 + 1 : M;
    const tr = fr - r0, tg = fg - g0, tb = fb - b0;
    const i000 = (b0 * N2 + g0 * N + r0) * 3, i100 = (b0 * N2 + g0 * N + r1) * 3, i010 = (b0 * N2 + g1 * N + r0) * 3, i110 = (b0 * N2 + g1 * N + r1) * 3;
    const i001 = (b1 * N2 + g0 * N + r0) * 3, i101 = (b1 * N2 + g0 * N + r1) * 3, i011 = (b1 * N2 + g1 * N + r0) * 3, i111 = (b1 * N2 + g1 * N + r1) * 3;
    for (let k = 0; k < 3; k++) {
      const c00 = L[i000 + k]! + (L[i100 + k]! - L[i000 + k]!) * tr, c10 = L[i010 + k]! + (L[i110 + k]! - L[i010 + k]!) * tr;
      const c01 = L[i001 + k]! + (L[i101 + k]! - L[i001 + k]!) * tr, c11 = L[i011 + k]! + (L[i111 + k]! - L[i011 + k]!) * tr;
      const c0 = c00 + (c10 - c00) * tg, c1 = c01 + (c11 - c01) * tg;
      d[i + k] = c0 + (c1 - c0) * tb;
    }
  }
}

/** Look one linear colour up in a LUT (trilinear), in place. */
export function lookup(lut: Lut3D, rgb: Float32Array): void {
  const r: Raster = { width: 1, height: 1, data: new Float32Array([rgb[0]!, rgb[1]!, rgb[2]!, 1]), space: "srgb" };
  applyLut(r, lut);
  rgb[0] = r.data[0]!; rgb[1] = r.data[1]!; rgb[2] = r.data[2]!;
}

/**
 * Parse an Adobe/Resolve `.cube` 3D LUT (LUT_3D_SIZE, optional DOMAIN_MIN / DOMAIN_MAX, TITLE). Its values are
 * taken as encoded (display) RGB, the usual case, and turned into linear output. Throws on a malformed file.
 */
export function parseCube(text: string): Lut3D {
  let size = 0, title: string | undefined, min = [0, 0, 0], max = [1, 1, 1];
  const vals: number[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^([A-Z_0-9]+)\s+(.*)$/.exec(line);
    if (m && /^[A-Z]/.test(line)) {
      const [, key, rest] = m;
      if (key === "LUT_3D_SIZE") size = parseInt(rest!, 10);
      else if (key === "TITLE") title = rest!.replace(/^"|"$/g, "");
      else if (key === "DOMAIN_MIN") min = rest!.split(/\s+/).map(Number);
      else if (key === "DOMAIN_MAX") max = rest!.split(/\s+/).map(Number);
      else if (key === "LUT_1D_SIZE") throw new Error("parseCube: 1D LUTs are not supported");
      continue;
    }
    for (const v of line.split(/\s+/)) vals.push(Number(v));
  }
  if (size < 2 || size > 256 || vals.length !== size ** 3 * 3 || vals.some((v) => !Number.isFinite(v))) throw new Error(`parseCube: expected ${size ** 3 * 3} numbers for size ${size}`);
  const data = new Float32Array(vals.length);
  for (let i = 0; i < vals.length; i++) { const k = i % 3, v = (vals[i]! - min[k]!) / ((max[k]! - min[k]!) || 1); data[i] = toLinear(Math.min(1, Math.max(0, v))); }
  return { size, data, title };
}

/** Write a LUT as `.cube` text (encoded values, 6 decimals). */
export function toCube(lut: Lut3D, title = "March"): string {
  const enc = (v: number): string => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055).toFixed(6);
  const rows = [`TITLE "${title.replace(/"/g, "")}"`, `LUT_3D_SIZE ${lut.size}`];
  for (let i = 0; i < lut.data.length; i += 3) rows.push(`${enc(lut.data[i]!)} ${enc(lut.data[i + 1]!)} ${enc(lut.data[i + 2]!)}`);
  return `${rows.join("\n")}\n`;
}
