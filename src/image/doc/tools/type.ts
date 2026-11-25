// Type tools (T): horizontal and vertical type, horizontal and vertical type mask. Click for point text, drag for a
// text box, click an existing text layer to edit it. An edit session (from the click until commit) is ONE history
// step: the session opens doc.begin() and commit / Escape close or cancel it. Typing, Backspace / Delete, arrows
// (Shift extends, Ctrl by word), Home / End, Enter (new paragraph), Ctrl+Enter commits, Ctrl+A selects all.
// The mask tools edit a temporary text and turn it into a selection on commit. typeText() takes IME / paste input.

import type { ImageDocument } from "../document.ts";
import type { RGBA, TextLayer } from "../layers.ts";
import * as select from "../selection.ts";
import { textData, type CharStyle, type ParaStyle, type TextData } from "../text-model.ts";
import { caretAt, hitTest, moveCaret, selectionQuads, type TextLayout } from "../text/layout.ts";
import { layoutOf, newTextLayer, bakeTextOffset, textMask } from "../text/render.ts";
import { deleteRange, insertText, textLength } from "../text/styles.ts";
import type { OverlayShape, PointerSample, Tool, ToolContext, ToolOption } from "./tool.ts";

interface Session {
  /** The layer being edited (null for the mask tools). */
  layerId: string | null;
  /** The mask tools' temporary text. */
  temp: TextData | null;
  caret: number;
  anchor: number;
  created: boolean;
  dragging: boolean;
  vertical: boolean;
  mask: boolean;
}
interface Press { start: [number, number]; end: [number, number] }

const sess = (ctx: ToolContext): Session | null => (ctx.shared.typeSession as Session | null | undefined) ?? null;

function textOf(ctx: ToolContext, s: Session): TextData | null {
  if (s.temp) return s.temp;
  const l = s.layerId ? ctx.doc.find(s.layerId) : null;
  return l && l.kind === "text" ? l.text : null;
}

function layoutFor(ctx: ToolContext, s: Session): TextLayout | null {
  const t = textOf(ctx, s);
  return t ? layoutOf(ctx.doc, t) : null;
}

const OPTIONS: ToolOption[] = [
  { key: "font", label: "Font", kind: "font", default: "system-ui" },
  { key: "weight", label: "Weight", kind: "number", min: 100, max: 900, step: 100, default: 400 },
  { key: "size", label: "Size", kind: "number", min: 1, max: 1296, unit: "pt", default: 36 },
  { key: "antialias", label: "Anti-aliasing", kind: "choice", default: "smooth", options: ["none", "sharp", "crisp", "strong", "smooth"].map((v) => ({ value: v, label: v[0]!.toUpperCase() + v.slice(1) })) },
  { key: "align", label: "Align", kind: "choice", default: "left", options: [{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }] },
  { key: "color", label: "Color", kind: "color", default: null },
  { key: "lang", label: "Language", kind: "text", default: "" },
];

function charFrom(ctx: ToolContext): Partial<CharStyle> {
  const o = ctx.options;
  const c: Partial<CharStyle> = { font: String(o.font ?? "system-ui"), weight: Number(o.weight ?? 400), size: Number(o.size ?? 36), antialias: (o.antialias as CharStyle["antialias"] | undefined) ?? "smooth", color: [...((Array.isArray(o.color) ? o.color : ctx.fg) as RGBA)] as RGBA };
  if (o.lang) c.lang = String(o.lang);
  return c;
}
const paraFrom = (ctx: ToolContext): Partial<ParaStyle> => ({ align: (ctx.options.align as ParaStyle["align"] | undefined) ?? "left" });

/** The top-most text layer whose text is under a point. */
export function textLayerAt(doc: ImageDocument, x: number, y: number): TextLayer | null {
  const all = doc.all().filter((l): l is TextLayer => l.kind === "text" && doc.visibleInTree(l.id));
  for (let i = all.length - 1; i >= 0; i--) {
    const l = all[i]!, f = l.text.frame, ox = l.raster.ox, oy = l.raster.oy;
    if (f.type === "box" && x >= f.x + ox && x <= f.x + f.w + ox && y >= f.y + oy && y <= f.y + f.h + oy) return l;
    const b = layoutOf(doc, l.text).bounds;
    if (b && x >= b.x + ox - 4 && x <= b.x + b.w + ox + 4 && y >= b.y + oy - 4 && y <= b.y + b.h + oy + 4) return l;
  }
  return null;
}

/** Start editing an existing text layer (opens the session's history step). */
export function beginEdit(ctx: ToolContext, l: TextLayer, caret = textLength(l.text)): void {
  ctx.doc.begin("Edit Type", "type");
  bakeTextOffset(l);
  ctx.shared.typeSession = { layerId: l.id, temp: null, caret, anchor: caret, created: false, dragging: false, vertical: l.text.orientation === "vertical", mask: false } satisfies Session;
}

/** Insert text at the caret (replacing the selection). IME and paste go through here. */
export function typeText(ctx: ToolContext, s: string): void {
  const se = sess(ctx), t = se && textOf(ctx, se);
  if (!se || !t) return;
  if (se.anchor !== se.caret) { se.caret = deleteRange(t, se.anchor, se.caret); }
  se.caret = insertText(t, se.caret, s.replace(/\r\n?/g, "\n"));
  se.anchor = se.caret;
  renamed(ctx, se);
  ctx.invalidate(null);
}

function renamed(ctx: ToolContext, se: Session): void {
  const l = se.layerId ? ctx.doc.find(se.layerId) : null;
  if (l && l.kind === "text" && l.data?.autoName !== false) {
    const first = l.text.paragraphs.map((p) => p.runs.map((r) => r.text).join("")).join("\n").split("\n")[0]!.trim().slice(0, 40);
    l.name = first || "Text";
  }
}

/** Finish the session: one history step (an empty new layer is dropped; the mask tools make a selection). */
export function commitType(ctx: ToolContext): void {
  const se = sess(ctx);
  if (!se) return;
  ctx.shared.typeSession = null;
  const doc = ctx.doc;
  if (se.mask && se.temp) {
    const m = textMask(doc, se.temp);
    doc.change("Type Mask", () => select.combine(doc, m, (ctx.options.selectOp as select.SelectOp | undefined) ?? "new"), "select");
    ctx.invalidate(null);
    return;
  }
  const l = se.layerId ? doc.find(se.layerId) : null;
  if (l && l.kind === "text" && !textLength(l.text) && se.created) doc.remove([l.id]);
  doc.commit(se.created ? "Type Tool" : "Edit Type");
  ctx.invalidate(null);
}

/** Throw the session away (Escape). */
export function cancelType(ctx: ToolContext): void {
  const se = sess(ctx);
  if (!se) return;
  ctx.shared.typeSession = null;
  if (!se.mask) ctx.doc.cancel();
  ctx.invalidate(null);
}

function caretKey(ctx: ToolContext, se: Session, e: { key: string; shift: boolean; ctrl: boolean; meta: boolean }): boolean {
  const L = layoutFor(ctx, se), t = textOf(ctx, se);
  if (!L || !t) return false;
  const word = e.ctrl || e.meta;
  const map: Record<string, Parameters<typeof moveCaret>[2]> = se.vertical
    ? { ArrowUp: "left", ArrowDown: "right", ArrowLeft: "down", ArrowRight: "up", Home: "home", End: "end" }
    : { ArrowLeft: word ? "wordLeft" : "left", ArrowRight: word ? "wordRight" : "right", ArrowUp: "up", ArrowDown: "down", Home: word ? "start" : "home", End: word ? "finish" : "end" };
  const how = map[e.key];
  if (!how) return false;
  // without Shift, left / right collapse a selection to its edge
  if (!e.shift && se.anchor !== se.caret && (how === "left" || how === "right")) {
    se.caret = how === "left" ? Math.min(se.anchor, se.caret) : Math.max(se.anchor, se.caret);
  } else se.caret = moveCaret(L, se.caret, how);
  if (!e.shift) se.anchor = se.caret;
  return true;
}

/** A type tool (orientation, mask). */
export function makeTypeTool(id: string, label: string, vertical: boolean, mask: boolean): Tool {
  const pressKey = `typePress:${id}`;
  return {
    id, group: "type", label, icon: mask ? "type-mask" : vertical ? "type-vertical" : "type", key: "t",
    options: mask ? [...OPTIONS, { key: "selectOp", label: "Selection", kind: "select-op", default: "new" }] : OPTIONS,
    cursor: () => "text",
    down(ctx, p) {
      const se = sess(ctx);
      if (se) {
        const L = layoutFor(ctx, se);
        const b = L?.bounds;
        if (L && b && p.x >= b.x - 8 && p.x <= b.x + b.w + 8 && p.y >= b.y - 8 && p.y <= b.y + b.h + 8) {
          se.caret = hitTest(L, p.x, p.y);
          if (!p.shift) se.anchor = se.caret;
          se.dragging = true;
          ctx.invalidate(null);
          return;
        }
        commitType(ctx);
      }
      if (!mask) {
        const hit = textLayerAt(ctx.doc, p.x, p.y);
        if (hit) {
          beginEdit(ctx, hit, 0);
          const s2 = sess(ctx)!, L = layoutOf(ctx.doc, hit.text);
          s2.caret = s2.anchor = hitTest(L, p.x, p.y);
          s2.dragging = true;
          ctx.doc.setActive(hit.id);
          ctx.invalidate(null);
          return;
        }
      }
      ctx.shared[pressKey] = { start: [p.x, p.y], end: [p.x, p.y] } satisfies Press;
    },
    move(ctx, p) {
      const se = sess(ctx);
      if (se?.dragging) {
        const L = layoutFor(ctx, se);
        if (L) { se.caret = hitTest(L, p.x, p.y); ctx.invalidate(null); }
        return;
      }
      const pr = ctx.shared[pressKey] as Press | undefined;
      if (pr) { pr.end = [p.x, p.y]; ctx.invalidate(null); }
    },
    up(ctx, p: PointerSample) {
      const se = sess(ctx);
      if (se?.dragging) { se.dragging = false; return; }
      const pr = ctx.shared[pressKey] as Press | undefined;
      ctx.shared[pressKey] = undefined;
      if (!pr) return;
      pr.end = [p.x, p.y];
      const box = Math.abs(pr.end[0] - pr.start[0]) > 4 && Math.abs(pr.end[1] - pr.start[1]) > 4;
      const frame: TextData["frame"] = box
        ? { type: "box", x: Math.min(pr.start[0], pr.end[0]), y: Math.min(pr.start[1], pr.end[1]), w: Math.abs(pr.end[0] - pr.start[0]), h: Math.abs(pr.end[1] - pr.start[1]) }
        : { type: "point", x: pr.start[0], y: pr.start[1] };
      const t = textData("", frame, charFrom(ctx), paraFrom(ctx));
      if (vertical) t.orientation = "vertical";
      if (mask) {
        ctx.shared.typeSession = { layerId: null, temp: t, caret: 0, anchor: 0, created: true, dragging: false, vertical, mask: true } satisfies Session;
      } else {
        ctx.doc.begin("Type Tool", "type");
        const l = ctx.doc.add(newTextLayer(ctx.doc, t, "Text"));
        ctx.shared.typeSession = { layerId: l.id, temp: null, caret: 0, anchor: 0, created: true, dragging: false, vertical, mask: false } satisfies Session;
      }
      ctx.invalidate(null);
    },
    dbl(ctx, p) {
      // double click: select the word
      const se = sess(ctx), L = se && layoutFor(ctx, se);
      if (!se || !L) return;
      const i = hitTest(L, p.x, p.y);
      se.anchor = moveCaret(L, Math.min(L.text.length, i + 1), "wordLeft");
      se.caret = moveCaret(L, se.anchor, "wordRight");
      ctx.invalidate(null);
    },
    key_(ctx, e) {
      const se = sess(ctx);
      if (!se || e.type !== "down") return false;
      const t = textOf(ctx, se);
      if (!t) return false;
      if (e.key === "Escape") { cancelType(ctx); return true; }
      if (e.key === "Enter" && (e.ctrl || e.meta)) { commitType(ctx); return true; }
      if ((e.ctrl || e.meta) && e.key.toLowerCase() === "a") { se.anchor = 0; se.caret = textLength(t); ctx.invalidate(null); return true; }
      if (e.key === "Enter") { typeText(ctx, "\n"); return true; }
      if (e.key === "Backspace" || e.key === "Delete") {
        if (se.anchor !== se.caret) se.caret = deleteRange(t, se.anchor, se.caret);
        else if (e.key === "Backspace" && se.caret > 0) se.caret = deleteRange(t, se.caret - (/[\uDC00-\uDFFF]/.test(plainAt(t, se.caret - 1)) ? 2 : 1), se.caret);
        else if (e.key === "Delete" && se.caret < textLength(t)) deleteRange(t, se.caret, se.caret + (/[\uD800-\uDBFF]/.test(plainAt(t, se.caret)) ? 2 : 1));
        se.anchor = se.caret;
        renamed(ctx, se);
        ctx.invalidate(null);
        return true;
      }
      if (caretKey(ctx, se, e)) { ctx.invalidate(null); return true; }
      if (e.key.length >= 1 && [...e.key].length === 1 && !e.ctrl && !e.meta) { typeText(ctx, e.key); return true; }
      return false;
    },
    commit: commitType,
    cancel: cancelType,
    pending: (ctx) => !!sess(ctx),
    deactivate: (ctx) => { if (sess(ctx)) commitType(ctx); },
    overlay(ctx) {
      const out: OverlayShape[] = [];
      const pr = ctx.shared[pressKey] as Press | undefined;
      if (pr && Math.abs(pr.end[0] - pr.start[0]) > 4) out.push({ type: "rect", rect: { x: Math.min(pr.start[0], pr.end[0]), y: Math.min(pr.start[1], pr.end[1]), w: Math.abs(pr.end[0] - pr.start[0]), h: Math.abs(pr.end[1] - pr.start[1]) }, dash: true });
      const se = sess(ctx), L = se && layoutFor(ctx, se), t = se && textOf(ctx, se);
      if (!se || !L || !t) return out;
      if (t.frame.type === "box") out.push({ type: "rect", rect: { x: t.frame.x, y: t.frame.y, w: t.frame.w, h: t.frame.h }, dash: true, ...(L.overflow ? { color: "#e33" } : {}) });
      for (const q of selectionQuads(L, se.anchor, se.caret)) out.push({ type: "polyline", points: q, closed: true, color: "rgba(80,140,255,0.5)" });
      const c = caretAt(L, se.caret);
      out.push({ type: "line", x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2, width: 1 });
      return out;
    },
  };
}

const plainAt = (t: TextData, i: number): string => t.paragraphs.map((p) => p.runs.map((r) => r.text).join("")).join("\n")[i] ?? "";

export const typeTool = makeTypeTool("type", "Horizontal Type", false, false);
export const verticalTypeTool = makeTypeTool("type-vertical", "Vertical Type", true, false);
export const typeMaskTool = makeTypeTool("type-mask", "Horizontal Type Mask", false, true);
export const verticalTypeMaskTool = makeTypeTool("type-vertical-mask", "Vertical Type Mask", true, true);
export const typeTools: Tool[] = [typeTool, verticalTypeTool, verticalTypeMaskTool, typeMaskTool];
