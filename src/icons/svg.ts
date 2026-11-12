// SVG icon rendering. An icon is plain data ({ name, d: [...] }) on a 24×24 grid, drawn with the current text color as a
// 1.75px rounded stroke. Shapes: "o:cx,cy,r" circle, "b:x,y,w,h,rx" rectangle, anything else is path data. Built with
// createElementNS (no innerHTML, Trusted Types safe); every icon is its own export, so bundlers drop unused ones.

/** An icon: a name (for debugging and data-icon) and its shapes. */
export interface IconDef { readonly name: string; readonly d: readonly string[]; readonly fill?: boolean }

const NS = "http://www.w3.org/2000/svg";

/** Make an icon definition (frozen). `fill: true` draws filled shapes instead of strokes. */
/** Pure: unused icons are dropped from bundles (esbuild honours @__NO_SIDE_EFFECTS__). */
export const defineIcon = /* @__NO_SIDE_EFFECTS__ */ (name: string, d: readonly string[], fill = false): IconDef => Object.freeze({ name, d: Object.freeze([...d]), ...(fill ? { fill } : {}) });

export const isIconDef = (x: unknown): x is IconDef =>
  !!x && typeof x === "object" && Array.isArray((x as IconDef).d) && typeof (x as IconDef).name === "string";

function shape(spec: string): Element {
  const kind = spec.slice(0, 2);
  if (kind === "o:" || kind === "b:") {
    const n = spec.slice(2).split(",").map(Number);
    if (kind === "o:") {
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", String(n[0])); c.setAttribute("cy", String(n[1])); c.setAttribute("r", String(n[2]));
      return c;
    }
    const r = document.createElementNS(NS, "rect");
    r.setAttribute("x", String(n[0])); r.setAttribute("y", String(n[1])); r.setAttribute("width", String(n[2])); r.setAttribute("height", String(n[3]));
    if (n[4]) r.setAttribute("rx", String(n[4]));
    return r;
  }
  const p = document.createElementNS(NS, "path");
  p.setAttribute("d", spec);
  return p;
}

/** Render an icon as an <svg> element. Decorative (aria-hidden) unless a label is given. */
export function svgIcon(def: IconDef, cls = "hm-svg", label?: string): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", def.fill ? `${cls} hm-svg-fill` : cls);
  svg.setAttribute("data-icon", def.name);
  svg.setAttribute("focusable", "false");
  if (label) { svg.setAttribute("role", "img"); svg.setAttribute("aria-label", label); }
  else svg.setAttribute("aria-hidden", "true");
  for (const s of def.d) svg.appendChild(shape(s));
  return svg;
}
