// The shared drawing layer of icon packs (march/icons/<pack>): an icon's `paint` hook, run by paintIcon after its
// shapes. Kept out of the start-up code: it loads with the first pack icon.
//   grid      vb: "0 0 256 256" (Phosphor), "0 -960 960 960" (Material Symbols)…; default 24×24
//   stroke    sw: the set's own stroke width (Lucide 2, Heroicons 1.5…) on each shape (it wins over the inherited
//             --m-icon-stroke and goes away with the shapes when the <svg> is repainted)
//   fill      fill: true (on the icon itself) → .m-svg-fill: currentColor fill, no stroke
//   even-odd  eo: indexes of the shapes filled even-odd
//   RTL       rtl: true → .m-svg-rtl, mirrored in right-to-left text (arrows, back / forward, undo / redo…)
import type { IconDef } from "./svg.ts";

/** What a pack icon adds to an icon definition. */
export interface PackIconDef extends IconDef {
  readonly vb?: string;
  readonly sw?: number;
  readonly rtl?: boolean;
  readonly eo?: readonly number[];
}

/** The `paint` hook of every pack icon: grid, stroke width, RTL mirroring, even-odd fills. */
export function packPaint(svg: SVGSVGElement, def: IconDef): void {
  const d = def as PackIconDef, c = svg.classList;
  if (d.vb) svg.setAttribute("viewBox", d.vb);
  if (d.rtl) c.add("m-svg-rtl");
  if (d.sw) for (const s of svg.children) s.setAttribute("stroke-width", String(d.sw));
  if (d.eo) for (const i of d.eo) svg.children[i]?.setAttribute("fill-rule", "evenodd");
}

/** Make a pack icon (frozen): `packIcon("arrow-left", ["M19 12H5", …], { sw: 2, rtl: true })`. */
export const packIcon = /* @__NO_SIDE_EFFECTS__ */ (name: string, d: readonly string[], more: Omit<PackIconDef, "name" | "d" | "paint"> = {}): PackIconDef =>
  Object.freeze({ ...more, name, d: Object.freeze([...d]), paint: packPaint });
