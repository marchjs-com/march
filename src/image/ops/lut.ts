// lut: applies a 3D lookup table (a "film look" .cube file, or one exported from another editor). The table travels in
// the op as plain numbers (linear output, .cube order: red fastest), so a saved edit carries its look.
import { defineOp, opOf, type ImageOp } from "../op.ts";
import { applyLut, parseCube, type Lut3D } from "../lut.ts";
import type { Raster } from "../raster.ts";

export interface LutParams {
  /** Grid size N (2–256). */ size: number;
  /** N³ × 3 linear RGB outputs, red fastest. */ data: number[];
  /** Name shown in the editor. */ title?: string | undefined;
}

const valid = (p: LutParams): boolean => p.size >= 2 && Array.isArray(p.data) && p.data.length === p.size ** 3 * 3;

export const LUT = defineOp<LutParams>({
  type: "lut", kind: "color", defaults: { size: 2, data: [] },
  identity: (p) => !valid(p),
  prepare: (p) => ({ lut: { size: p.size, data: Float32Array.from(p.data) } satisfies Lut3D, px: { width: 1, height: 1, data: new Float32Array(4), space: "srgb" } satisfies Raster }),
  colorWith: (c, _p, data) => {
    const { lut, px } = data as { lut: Lut3D; px: Raster };
    px.data[0] = c[0]!; px.data[1] = c[1]!; px.data[2] = c[2]!;
    applyLut(px, lut);
    c[0] = px.data[0]!; c[1] = px.data[1]!; c[2] = px.data[2]!;
  },
});
/** A LUT op from a parsed table (`parseCube`, `lutOf`), values rounded to 6 decimals so the JSON stays small. */
export function lut(table: Lut3D, title = table.title): ImageOp<LutParams> {
  const p: Partial<LutParams> = { size: table.size, data: Array.from(table.data, (v) => Math.round(v * 1e6) / 1e6) };
  if (title) p.title = title;
  return opOf(LUT, p);
}
/** A LUT op from `.cube` text; `strength` 0–1 becomes the op's mix. Throws on a malformed file. */
export function lutFromCube(text: string, strength = 1): ImageOp<LutParams> {
  const op = lut(parseCube(text));
  if (strength < 1) op.mix = Math.max(0, strength);
  return op;
}
