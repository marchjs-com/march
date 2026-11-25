// SVG export without a DOM: a small XML writer and a document builder. Shape layers become <path> elements (solid or
// gradient fill, stroke), text layers <text> (one <tspan> per paragraph line and run), fill layers a <rect>, raster
// layers an <image> with an embedded PNG; groups <g> with opacity and blend mode; layer masks <mask>, vector masks
// <clipPath>. Adjustment layers and layer styles are not expressible as plain SVG: they are skipped (or, with
// `rasterize`, the whole document is embedded as one image).

import type { ImageDocument } from "../document.ts";
import { hasRaster, isContainer, type Gradient, type Layer, type Paint, type RGBA } from "../layers.ts";
import type { Anchor, PathData } from "../paths.ts";
import { renderHooks, renderLayer, renderRegion } from "../composite.ts";
import type { Rect } from "../tiles.ts";
import { encodePng } from "./png.ts";

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** A minimal streaming XML writer (attributes escaped, empty elements self-closed). */
export class XmlWriter {
  private out: string[] = [];
  private stack: string[] = [];
  private pretty: boolean;
  constructor(pretty = true) { this.pretty = pretty; }
  private pad(): string { return this.pretty ? "\n" + "  ".repeat(this.stack.length) : ""; }
  private attrs(a: Record<string, string | number | null | undefined>): string {
    let s = "";
    for (const [k, v] of Object.entries(a)) if (v !== null && v !== undefined && v !== "") s += ` ${k}="${esc(typeof v === "number" ? fmt(v) : v)}"`;
    return s;
  }
  open(tag: string, a: Record<string, string | number | null | undefined> = {}): this { this.out.push(`${this.pad()}<${tag}${this.attrs(a)}>`); this.stack.push(tag); return this; }
  close(): this { const t = this.stack.pop()!; this.out.push(`${this.pad()}</${t}>`); return this; }
  leaf(tag: string, a: Record<string, string | number | null | undefined> = {}, text?: string): this {
    this.out.push(text == null ? `${this.pad()}<${tag}${this.attrs(a)}/>` : `${this.pad()}<${tag}${this.attrs(a)}>${esc(text)}</${tag}>`);
    return this;
  }
  raw(s: string): this { this.out.push(s); return this; }
  toString(): string { while (this.stack.length) this.close(); return this.out.join("").replace(/^\n/, ""); }
}

const fmt = (v: number): string => (Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000));
const color = (c: RGBA): string => `#${[c[0], c[1], c[2]].map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("")}`;

/** SVG path data of a March path (cubic segments; closed subpaths end with Z). */
export function pathD(p: PathData): string {
  const parts: string[] = [];
  for (const sp of p.subpaths) {
    const a = sp.anchors;
    if (!a.length) continue;
    parts.push(`M${fmt(a[0]!.x)} ${fmt(a[0]!.y)}`);
    const seg = (s: Anchor, e: Anchor): void => {
      if (s.ox === s.x && s.oy === s.y && e.ix === e.x && e.iy === e.y) parts.push(`L${fmt(e.x)} ${fmt(e.y)}`);
      else parts.push(`C${fmt(s.ox)} ${fmt(s.oy)} ${fmt(e.ix)} ${fmt(e.iy)} ${fmt(e.x)} ${fmt(e.y)}`);
    };
    for (let i = 1; i < a.length; i++) seg(a[i - 1]!, a[i]!);
    if (sp.closed) { if (a.length > 1) seg(a[a.length - 1]!, a[0]!); parts.push("Z"); }
  }
  return parts.join("");
}

const BLEND_CSS = new Set(["multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"]);

export interface SvgOptions {
  /** Region of the document (default: all). */
  region?: Rect | undefined;
  /** Embed raster layers as PNG images (default true). */
  images?: boolean | undefined;
  /** One embedded image of the whole composite instead of elements (exact, not editable). */
  rasterize?: boolean | undefined;
  title?: string | undefined;
  pretty?: boolean | undefined;
}

const b64 = (u: Uint8Array): string => {
  const B = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let s = "";
  for (let i = 0; i < u.length; i += 3) {
    const a = u[i]!, b = u[i + 1] ?? 0, c = u[i + 2] ?? 0;
    s += B[a >> 2]! + B[((a & 3) << 4) | (b >> 4)]! + (i + 1 < u.length ? B[((b & 15) << 2) | (c >> 6)]! : "=") + (i + 2 < u.length ? B[c & 63]! : "=");
  }
  return s;
};

async function pngDataUrl(px: Float32Array, w: number, h: number, premultiplied: boolean): Promise<string> {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    const a = px[i + 3]!, k = premultiplied && a > 0 ? 1 / a : 1;
    data[i] = Math.round(Math.max(0, Math.min(1, px[i]! * k)) * 255); data[i + 1] = Math.round(Math.max(0, Math.min(1, px[i + 1]! * k)) * 255);
    data[i + 2] = Math.round(Math.max(0, Math.min(1, px[i + 2]! * k)) * 255); data[i + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
  }
  return `data:image/png;base64,${b64(await encodePng({ width: w, height: h, channels: 4, depth: 8, data }))}`;
}

/** Build an SVG document string. */
export async function exportSvg(doc: ImageDocument, o: SvgOptions = {}): Promise<string> {
  const r = o.region ?? doc.bounds;
  const x = new XmlWriter(o.pretty !== false);
  x.raw(`<?xml version="1.0" encoding="UTF-8"?>${o.pretty !== false ? "\n" : ""}`);
  x.open("svg", { xmlns: "http://www.w3.org/2000/svg", "xmlns:xlink": "http://www.w3.org/1999/xlink", width: r.w, height: r.h, viewBox: `${r.x} ${r.y} ${r.w} ${r.h}` });
  if (o.title ?? doc.name) x.leaf("title", {}, o.title ?? doc.name);
  if (o.rasterize) {
    const f = renderRegion(doc, r);
    x.leaf("image", { x: r.x, y: r.y, width: r.w, height: r.h, href: await pngDataUrl(f, r.w, r.h, true) });
    return x.toString();
  }
  let defs = 0;
  const id = (p: string): string => `${p}${++defs}`;
  const defsW = new XmlWriter(o.pretty !== false);

  const paintRef = (p: Paint | null, box: Rect): string => {
    if (!p) return "none";
    if (p.type === "solid") return color(p.color);
    if (p.type === "gradient") return gradientRef(p.gradient, box);
    return "#808080"; // patterns: a neutral stand-in
  };
  const gradientRef = (g: Gradient, box: Rect): string => {
    const gid = id("g");
    const pt = (v: [number, number]): [number, number] => (g.relative ? [box.x + v[0] * box.w, box.y + v[1] * box.h] : v);
    const [fx, fy] = pt(g.from), [tx, ty] = pt(g.to);
    const radial = g.type !== "linear";
    defsW.open(radial ? "radialGradient" : "linearGradient", radial
      ? { id: gid, gradientUnits: "userSpaceOnUse", cx: fx, cy: fy, r: Math.hypot(tx - fx, ty - fy) }
      : { id: gid, gradientUnits: "userSpaceOnUse", x1: fx, y1: fy, x2: tx, y2: ty });
    const stops = g.reverse ? [...g.stops].reverse().map((s) => ({ ...s, at: 1 - s.at })) : g.stops;
    for (const s of stops) defsW.leaf("stop", { offset: fmt(s.at), "stop-color": color(s.color), "stop-opacity": s.color[3] < 1 ? s.color[3] : null });
    defsW.close();
    return `url(#${gid})`;
  };
  const common = (l: Layer): Record<string, string | number | null> => ({
    id: l.name ? esc(l.name).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 40) || null : null,
    opacity: l.opacity < 1 ? l.opacity : null,
    style: l.blend !== "normal" && l.blend !== "pass-through" && BLEND_CSS.has(l.blend) ? `mix-blend-mode:${l.blend}` : null,
  });
  const masks = async (l: Layer): Promise<Record<string, string>> => {
    const a: Record<string, string> = {};
    if (l.vectorMask?.enabled) {
      const cid = id("c");
      defsW.open("clipPath", { id: cid }).leaf("path", { d: pathD(l.vectorMask.path), "clip-rule": l.vectorMask.path.fillRule === "evenodd" ? "evenodd" : null }).close();
      a["clip-path"] = `url(#${cid})`;
    }
    if (l.mask?.enabled && o.images !== false) {
      const m = l.mask.mask, mid = id("m");
      const px = new Float32Array(r.w * r.h * 4);
      for (let yy = 0; yy < r.h; yy++) for (let xx = 0; xx < r.w; xx++) {
        let v = m.get(r.x + xx, r.y + yy) / 255;
        if (l.mask.invert) v = 1 - v;
        v = 1 - l.mask.density * (1 - v);
        const i = (yy * r.w + xx) * 4;
        px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 1;
      }
      defsW.open("mask", { id: mid, maskUnits: "userSpaceOnUse", x: r.x, y: r.y, width: r.w, height: r.h }).leaf("image", { x: r.x, y: r.y, width: r.w, height: r.h, href: await pngDataUrl(px, r.w, r.h, false) }).close();
      a.mask = `url(#${mid})`;
    }
    return a;
  };

  const body = new XmlWriter(o.pretty !== false);
  const visit = async (list: Layer[]): Promise<void> => {
    for (const l of list) {
      if (!l.visible) continue;
      const attrs = { ...common(l), ...(await masks(l)) };
      if (isContainer(l)) {
        body.open("g", attrs);
        if (l.kind === "artboard" && l.background) body.leaf("rect", { x: l.rect.x, y: l.rect.y, width: l.rect.w, height: l.rect.h, fill: color(l.background) });
        await visit(l.children);
        body.close();
      } else if (l.kind === "shape") {
        const box = { x: 0, y: 0, w: doc.width, h: doc.height };
        const st = l.stroke;
        body.leaf("path", {
          ...attrs, d: pathD(l.path), fill: paintRef(l.fillPaint, box), "fill-opacity": l.fill < 1 ? l.fill : null, "fill-rule": l.path.fillRule === "evenodd" ? "evenodd" : null,
          stroke: st ? paintRef(st.paint, box) : null, "stroke-width": st ? st.width : null, "stroke-linecap": st && st.cap !== "butt" ? st.cap : null,
          "stroke-linejoin": st && st.join !== "miter" ? st.join : null, "stroke-dasharray": st?.dash?.length ? st.dash.join(" ") : null,
        });
      } else if (l.kind === "text") {
        const t = l.text, c = t.char;
        const fr = t.frame.type === "path" ? { x: 0, y: 0 } : t.frame;
        const lead = (c.leading ?? c.size * 1.2) * (doc.dpi / 72);
        const size = c.size * (doc.dpi / 72);
        const anchor = t.para.align === "center" || t.para.align === "justify-center" ? "middle" : t.para.align === "right" || t.para.align === "justify-right" ? "end" : null;
        const ax = t.frame.type === "box" ? (anchor === "middle" ? t.frame.x + t.frame.w / 2 : anchor === "end" ? t.frame.x + t.frame.w : t.frame.x) : fr.x;
        body.open("text", {
          ...attrs, x: ax, y: fr.y + (t.frame.type === "box" ? size : 0), "font-family": c.font, "font-size": size, "font-weight": c.weight !== 400 ? c.weight : null,
          "font-style": c.style === "italic" ? "italic" : null, fill: color(c.color), "fill-opacity": c.color[3] < 1 ? c.color[3] : null, "text-anchor": anchor,
          "letter-spacing": c.tracking ? fmt((c.tracking / 1000) * size) : null,
          transform: t.matrix ? `matrix(${t.matrix.map(fmt).join(" ")})` : null,
        });
        t.paragraphs.forEach((p, i) => {
          body.open("tspan", { x: ax, dy: i ? lead : null });
          for (const run of p.runs) {
            const s = run.style;
            body.leaf("tspan", {
              fill: s.color ? color(s.color) : null, "font-weight": s.weight ?? null, "font-style": s.style === "italic" ? "italic" : null,
              "font-size": s.size ? s.size * (doc.dpi / 72) : null, "font-family": s.font ?? null,
              "text-decoration": s.underline ? "underline" : s.strike ? "line-through" : null,
            }, run.text);
          }
          body.close();
        });
        body.close();
      } else if (l.kind === "fill") {
        body.leaf("rect", { ...attrs, x: r.x, y: r.y, width: r.w, height: r.h, fill: paintRef(l.paint, doc.bounds), "fill-opacity": l.fill < 1 ? l.fill : null });
      } else if (hasRaster(l) && o.images !== false) {
        renderHooks.prepare?.(doc, l);
        const b = l.raster.bounds();
        const area = b && { x: Math.max(b.x, r.x), y: Math.max(b.y, r.y), w: Math.min(b.x + b.w, r.x + r.w) - Math.max(b.x, r.x), h: Math.min(b.y + b.h, r.y + r.h) - Math.max(b.y, r.y) };
        if (!area || area.w <= 0 || area.h <= 0) continue;
        const px = renderLayer(doc, { ...l, mask: undefined, vectorMask: undefined } as Layer, area, false);
        if (l.fill < 1) for (let i = 3; i < px.length; i += 4) px[i] = px[i]! * l.fill;
        body.leaf("image", { ...attrs, x: area.x, y: area.y, width: area.w, height: area.h, href: await pngDataUrl(px, area.w, area.h, false) });
      }
      // adjustment layers: no SVG equivalent
    }
  };
  await visit(doc.layers);
  const d = defsW.toString();
  if (d) x.open("defs").raw(d.replace(/^/gm, o.pretty !== false ? "    " : "").replace(/^\s*/, o.pretty !== false ? "\n    " : "")).close();
  x.raw((o.pretty !== false ? "\n" : "") + body.toString().replace(/^/gm, o.pretty !== false ? "  " : ""));
  return x.toString();
}
