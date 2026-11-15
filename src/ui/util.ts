/// <reference path="../css.d.ts" />
// Helpers shared by the ui components: everything in core/util plus icon rendering.
import { h } from "../dom/h.ts";
import { svgIcon, isIconDef } from "../icons/svg.ts";
export * from "../core/util.ts";

/** Render an icon prop: an IconDef (march/icons) becomes an SVG, a string (emoji, short text) an aria-hidden span; nodes pass through. */
export function icon(x: unknown, cls = "m-icon"): unknown {
  if (x == null || x === false) return null;
  if (isIconDef(x)) return h("span", { class: cls, "aria-hidden": "true" }, svgIcon(x));
  return typeof x === "string" ? h("span", { class: cls, "aria-hidden": "true" }, x) : x;
}

/** Inline SVG glyph for built-in components (decorative). */
export const glyph = (def: Parameters<typeof svgIcon>[0], cls = "m-svg"): SVGSVGElement => svgIcon(def, cls);
