// Measuring and annotation tools: eyedropper (I), color sampler (up to 10 points, draggable), ruler (distance and angle,
// straighten through a callback), note and count. Colors read the active layer or the merged image, averaged over a
// square sample (point, 3×3 … 101×101).

import type { CountGroup, ImageDocument, Note, Sampler } from "../document.ts";
import { renderRegion } from "../composite.ts";
import { hasRaster, newId, type RGBA } from "../layers.ts";
import type { OverlayShape, Tool, ToolContext } from "./tool.ts";

export type SampleSize = 1 | 3 | 5 | 11 | 31 | 51 | 101;
export const SAMPLE_SIZES: SampleSize[] = [1, 3, 5, 11, 31, 51, 101];
const SIZE_OPTIONS = SAMPLE_SIZES.map((n) => ({ value: String(n), label: n === 1 ? "Point Sample" : `${n} by ${n} Average` }));

/** Average color of a square around (x, y): straight RGBA, alpha the mean coverage. */
export function sampleColor(doc: ImageDocument, x: number, y: number, size: number = 1, source: "current" | "all" = "all"): RGBA {
  const half = (size - 1) >> 1, xi = Math.floor(x), yi = Math.floor(y);
  const r = { x: Math.max(0, xi - half), y: Math.max(0, yi - half), w: 0, h: 0 };
  r.w = Math.min(doc.width, xi + half + 1) - r.x; r.h = Math.min(doc.height, yi + half + 1) - r.y;
  if (r.w <= 0 || r.h <= 0) return [0, 0, 0, 0];
  const l = doc.active;
  let px: Float32Array, premul: boolean;
  if (source === "current" && l && hasRaster(l)) { px = l.raster.read(r.x, r.y, r.w, r.h); premul = false; }
  else { px = renderRegion(doc, r); premul = true; }
  let sr = 0, sg = 0, sb = 0, sa = 0;
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3]!, k = premul ? 1 : a;
    sr += px[i]! * k; sg += px[i + 1]! * k; sb += px[i + 2]! * k; sa += a;
  }
  const n = px.length / 4;
  return sa > 0 ? [sr / sa, sg / sa, sb / sa, sa / n] : [0, 0, 0, 0];
}

// ——— eyedropper ———

export function eyedropperTool(): Tool {
  let sampling: { prev: RGBA; which: "fg" | "bg"; at: [number, number] } | null = null;
  const pick = (ctx: ToolContext, x: number, y: number): void => {
    if (!sampling) return;
    const c = sampleColor(ctx.doc, x, y, Number(ctx.options.sampleSize ?? 1), ctx.options.sample === "current" ? "current" : "all");
    if (c[3] <= 0) return;
    ctx.setColor(sampling.which, [c[0], c[1], c[2], 1]);
    sampling.at = [x, y];
    ctx.invalidate(null);
  };
  return {
    id: "eyedropper", group: "eyedropper", label: "Eyedropper Tool", icon: "pipette", key: "I",
    options: [
      { key: "sampleSize", label: "Sample Size", kind: "choice", default: "1", options: SIZE_OPTIONS },
      { key: "sample", label: "Sample", kind: "choice", default: "all", options: [{ value: "current", label: "Current Layer" }, { value: "all", label: "All Layers" }] },
      { key: "showRing", label: "Show Sampling Ring", kind: "boolean", default: true },
    ],
    cursor: () => "eyedropper",
    down(ctx, p) {
      const which = p.alt ? "bg" : "fg";
      sampling = { prev: [...ctx[which]] as RGBA, which, at: [p.x, p.y] };
      pick(ctx, p.x, p.y);
    },
    move(ctx, p) { pick(ctx, p.x, p.y); },
    up(ctx) { if (sampling) { sampling = null; ctx.invalidate(null); } },
    cancel(ctx) { if (sampling) { ctx.setColor(sampling.which, sampling.prev); sampling = null; } },
    overlay(ctx): OverlayShape[] {
      if (!sampling || ctx.options.showRing === false) return [];
      // the sampling ring: new color on top, previous below (the UI draws it as a ring around the pointer)
      const [x, y] = sampling.at, r = 40 / ctx.zoom, cur = ctx[sampling.which];
      const css = (c: RGBA): string => `rgb(${Math.round(c[0] * 255)} ${Math.round(c[1] * 255)} ${Math.round(c[2] * 255)})`;
      return [
        { type: "rect", rect: { x: x - r, y: y - r, w: 2 * r, h: r }, fill: css(cur), color: css(cur) },
        { type: "rect", rect: { x: x - r, y, w: 2 * r, h: r }, fill: css(sampling.prev), color: css(sampling.prev) },
      ];
    },
  };
}

// ——— color sampler ———

/** The color a sampler reads now. */
export const readSampler = (doc: ImageDocument, s: Sampler): RGBA => sampleColor(doc, s.x, s.y, s.size, "all");

export function colorSamplerTool(): Tool {
  let drag: { id: string; dx: number; dy: number } | null = null;
  const hit = (ctx: ToolContext, x: number, y: number): Sampler | null => {
    const r = 6 / ctx.zoom;
    return ctx.doc.samplers.find((s) => Math.hypot(s.x + 0.5 - x, s.y + 0.5 - y) <= r) ?? null;
  };
  return {
    id: "color-sampler", group: "eyedropper", label: "Color Sampler Tool", icon: "crosshair",
    options: [{ key: "sampleSize", label: "Sample Size", kind: "choice", default: "1", options: SIZE_OPTIONS }],
    cursor: () => "crosshair",
    down(ctx, p) {
      const doc = ctx.doc, h = hit(ctx, p.x, p.y);
      if (h && p.alt) { doc.change("Delete Color Sampler", () => { doc.samplers = doc.samplers.filter((s) => s !== h); }); return; }
      if (h) { drag = { id: h.id, dx: h.x - p.x, dy: h.y - p.y }; doc.begin("Move Color Sampler"); return; }
      if (doc.samplers.length >= 10) { ctx.announce("Up to 10 color samplers"); return; }
      const s: Sampler = { id: newId("s"), x: Math.floor(p.x), y: Math.floor(p.y), size: (Number(ctx.options.sampleSize ?? 1) as Sampler["size"]), space: "rgb" };
      doc.change("Color Sampler", () => { doc.samplers = [...doc.samplers, s]; });
      drag = { id: s.id, dx: 0, dy: 0 };
      doc.begin("Move Color Sampler");
    },
    move(ctx, p) {
      if (!drag) return;
      const id = drag.id, x = Math.floor(p.x + drag.dx), y = Math.floor(p.y + drag.dy);
      ctx.doc.samplers = ctx.doc.samplers.map((s) => (s.id === id ? { ...s, x: Math.max(0, Math.min(ctx.doc.width - 1, x)), y: Math.max(0, Math.min(ctx.doc.height - 1, y)) } : s));
      ctx.invalidate(null);
    },
    up(ctx) { if (drag) { drag = null; ctx.doc.commit(); } },
    cancel(ctx) { if (drag) { drag = null; ctx.doc.cancel(); } },
    overlay(ctx) {
      return ctx.doc.samplers.flatMap((s, i): OverlayShape[] => [{ type: "crosshair", x: s.x + 0.5, y: s.y + 0.5 }, { type: "label", x: s.x + 4, y: s.y + 4, text: String(i + 1) }]);
    },
  };
}

// ——— ruler ———

export interface Measure { x: number; y: number; w: number; h: number; /** Degrees, counterclockwise from the x axis (y up). */ angle: number; length: number }

export function measure(x1: number, y1: number, x2: number, y2: number): Measure {
  const w = x2 - x1, h = y2 - y1;
  return { x: x1, y: y1, w, h, angle: (Math.atan2(-h, w) * 180) / Math.PI, length: Math.hypot(w, h) };
}

/** The rotation that makes the ruler line horizontal (Image › Straighten / the ruler's Straighten Layer). */
export function straightenAngle(m: Measure): number {
  let a = m.angle;
  if (a > 90) a -= 180;
  if (a < -90) a += 180;
  // a nearly vertical line straightens to vertical
  if (a > 45) a -= 90;
  if (a < -45) a += 90;
  return a;
}

export interface RulerLine { x1: number; y1: number; x2: number; y2: number; /** Protractor arm (Alt-drag from an end). */ x3?: number | undefined; y3?: number | undefined }

export function rulerTool(): Tool {
  let drag: { end: "new" | "a" | "b" | "c"; ox: number; oy: number } | null = null;
  const line = (ctx: ToolContext): RulerLine | null => (ctx.shared.ruler as RulerLine | undefined) ?? null;
  const tool: Tool & { straighten(ctx: ToolContext): number | null; clear(ctx: ToolContext): void } = {
    id: "ruler", group: "eyedropper", label: "Ruler Tool", icon: "ruler",
    options: [{ key: "useMeasurementScale", label: "Use Measurement Scale", kind: "boolean", default: false }],
    cursor: () => "crosshair",
    down(ctx, p) {
      const l = line(ctx), r = 6 / ctx.zoom;
      if (l && Math.hypot(p.x - l.x1, p.y - l.y1) <= r) { drag = p.alt ? { end: "c", ox: l.x1, oy: l.y1 } : { end: "a", ox: 0, oy: 0 }; if (p.alt) ctx.shared.ruler = { ...l, x3: p.x, y3: p.y }; return; }
      if (l && Math.hypot(p.x - l.x2, p.y - l.y2) <= r) { drag = { end: "b", ox: 0, oy: 0 }; return; }
      ctx.shared.ruler = { x1: p.x, y1: p.y, x2: p.x, y2: p.y };
      drag = { end: "new", ox: 0, oy: 0 };
    },
    move(ctx, p) {
      const l = line(ctx);
      if (!drag || !l) return;
      let { x, y } = p;
      const from = drag.end === "a" ? [l.x2, l.y2] : [l.x1, l.y1];
      if (p.shift) {
        const a = Math.round(Math.atan2(y - from[1]!, x - from[0]!) / (Math.PI / 4)) * (Math.PI / 4), len = Math.hypot(x - from[0]!, y - from[1]!);
        x = from[0]! + Math.cos(a) * len; y = from[1]! + Math.sin(a) * len;
      }
      if (drag.end === "a") ctx.shared.ruler = { ...l, x1: x, y1: y };
      else if (drag.end === "c") ctx.shared.ruler = { ...l, x3: x, y3: y };
      else ctx.shared.ruler = { ...l, x2: x, y2: y };
      ctx.invalidate(null);
    },
    up() { drag = null; },
    /** Straighten Layer: rotates through ctx.shared.straighten(angle) (the transform module), returns the angle. */
    straighten(ctx) {
      const l = line(ctx);
      if (!l) return null;
      const a = straightenAngle(measure(l.x1, l.y1, l.x2, l.y2));
      const fn = ctx.shared.straighten as ((angle: number, line: RulerLine) => void) | undefined;
      fn?.(a, l);
      ctx.announce(`Straighten ${a.toFixed(2)}°`);
      delete ctx.shared.ruler;
      return a;
    },
    clear(ctx) { delete ctx.shared.ruler; ctx.invalidate(null); },
    key_(ctx, e) { if (e.type === "down" && (e.key === "Delete" || e.key === "Backspace" || e.key === "Escape")) { this.clear(ctx); return true; } return false; },
    overlay(ctx) {
      const l = line(ctx);
      if (!l) return [];
      const m = measure(l.x1, l.y1, l.x2, l.y2);
      const out: OverlayShape[] = [{ type: "line", x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2 }, { type: "handle", x: l.x1, y: l.y1, id: "a", shape: "circle" }, { type: "handle", x: l.x2, y: l.y2, id: "b", shape: "circle" }];
      let text = `W: ${m.w.toFixed(1)}  H: ${m.h.toFixed(1)}  A: ${m.angle.toFixed(1)}°  L1: ${m.length.toFixed(2)}`;
      if (l.x3 != null && l.y3 != null) {
        const m2 = measure(l.x1, l.y1, l.x3, l.y3);
        let between = Math.abs(m.angle - m2.angle);
        if (between > 180) between = 360 - between;
        out.push({ type: "line", x1: l.x1, y1: l.y1, x2: l.x3, y2: l.y3 });
        text = `A: ${between.toFixed(1)}°  L1: ${m.length.toFixed(2)}  L2: ${m2.length.toFixed(2)}`;
      }
      out.push({ type: "label", x: (l.x1 + l.x2) / 2, y: (l.y1 + l.y2) / 2, text });
      return out;
    },
  };
  return tool;
}

// ——— note ———

export function noteTool(): Tool {
  let drag: { id: string; dx: number; dy: number; moved: boolean } | null = null;
  const hit = (ctx: ToolContext, x: number, y: number): Note | null => {
    const r = 10 / ctx.zoom;
    return [...ctx.doc.notes].reverse().find((n) => Math.abs(n.x - x) <= r && Math.abs(n.y - y) <= r) ?? null;
  };
  return {
    id: "note", group: "eyedropper", label: "Note Tool", icon: "sticky-note",
    options: [
      { key: "author", label: "Author", kind: "text", default: "" },
      { key: "color", label: "Color", kind: "color", default: [1, 0.86, 0.3, 1] },
    ],
    cursor: () => "pointer",
    down(ctx, p) {
      const doc = ctx.doc, h = hit(ctx, p.x, p.y);
      if (h) { ctx.shared.activeNote = h.id; drag = { id: h.id, dx: h.x - p.x, dy: h.y - p.y, moved: false }; doc.begin("Move Note"); return; }
      const n: Note = { id: newId("n"), x: Math.round(p.x), y: Math.round(p.y), author: String(ctx.options.author ?? ctx.shared.author ?? ""), text: "", color: (ctx.options.color as RGBA | undefined) ?? [1, 0.86, 0.3, 1], at: Date.now() };
      doc.change("New Note", () => { doc.notes = [...doc.notes, n]; });
      ctx.shared.activeNote = n.id;
      void ctx.prompt?.("note", n);
    },
    move(ctx, p) {
      if (!drag) return;
      const id = drag.id, x = Math.round(p.x + drag.dx), y = Math.round(p.y + drag.dy);
      drag.moved = true;
      ctx.doc.notes = ctx.doc.notes.map((n) => (n.id === id ? { ...n, x, y } : n));
      ctx.invalidate(null);
    },
    up(ctx) { if (drag) { drag = null; ctx.doc.commit(); } },
    dbl(ctx, p) { const h = hit(ctx, p.x, p.y); if (h) void ctx.prompt?.("note", h); },
    key_(ctx, e) {
      const id = ctx.shared.activeNote as string | undefined;
      if (e.type !== "down" || !id || (e.key !== "Delete" && e.key !== "Backspace")) return false;
      ctx.doc.change("Delete Note", () => { ctx.doc.notes = ctx.doc.notes.filter((n) => n.id !== id); });
      delete ctx.shared.activeNote;
      return true;
    },
    cancel(ctx) { if (drag) { drag = null; ctx.doc.cancel(); } },
    overlay(ctx) { return ctx.doc.notes.map((n): OverlayShape => ({ type: "pin", x: n.x, y: n.y, id: n.id, active: ctx.shared.activeNote === n.id })); },
  };
}

/** Change a note's text (the note panel). */
export function setNoteText(doc: ImageDocument, id: string, text: string): void {
  doc.change("Edit Note", () => { doc.notes = doc.notes.map((n) => (n.id === id ? { ...n, text } : n)); });
}

// ——— count ———

const COUNT_COLORS: RGBA[] = [[0.9, 0.2, 0.2, 1], [0.2, 0.5, 0.95, 1], [0.15, 0.7, 0.35, 1], [0.95, 0.6, 0.1, 1], [0.6, 0.3, 0.9, 1]];

/** The count group a click adds to (options.group, else the last group, else a new one). Call inside a change. */
function countGroup(doc: ImageDocument, id: unknown): CountGroup {
  let g = doc.counts.find((c) => c.id === id) ?? doc.counts[doc.counts.length - 1];
  if (!g) {
    g = { id: newId("k"), name: `Count Group ${doc.counts.length + 1}`, color: COUNT_COLORS[doc.counts.length % COUNT_COLORS.length]!, points: [], size: 8, visible: true };
    doc.counts = [...doc.counts, g];
  }
  return g;
}

export function countTool(): Tool {
  return {
    id: "count", group: "eyedropper", label: "Count Tool", icon: "hash",
    options: [
      { key: "group", label: "Count Group", kind: "text", default: "" },
      { key: "size", label: "Label Size", kind: "number", min: 6, max: 72, default: 8 },
    ],
    cursor: () => "crosshair",
    down(ctx, p) {
      const doc = ctx.doc;
      doc.change(p.alt ? "Remove Count" : "Count", () => {
        const g = countGroup(doc, ctx.options.group);
        let points = g.points;
        if (p.alt) {
          let best = -1, bd = 10 / ctx.zoom;
          points.forEach(([x, y], i) => { const d = Math.hypot(x - p.x, y - p.y); if (d <= bd) { bd = d; best = i; } });
          if (best >= 0) points = points.filter((_, i) => i !== best);
        } else points = [...points, [Math.round(p.x), Math.round(p.y)]];
        doc.counts = doc.counts.map((c) => (c.id === g.id ? { ...c, points, size: Number(ctx.options.size ?? c.size) } : c));
      });
    },
    overlay(ctx) {
      return ctx.doc.counts.filter((g) => g.visible).flatMap((g) => g.points.map(([x, y], i): OverlayShape => ({ type: "label", x, y, text: String(i + 1) })));
    },
  };
}

/** Clear the points of one count group (or all). */
export function clearCounts(doc: ImageDocument, groupId?: string): void {
  doc.change("Clear Count", () => { doc.counts = doc.counts.map((c) => (!groupId || c.id === groupId ? { ...c, points: [] } : c)); });
}
