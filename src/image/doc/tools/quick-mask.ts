// Quick mask mode (Q): the selection becomes a temporary channel shown as a colored overlay. Painting tools write into
// it while ctx.shared.target === "quickmask" (black adds mask, white removes it); leaving the mode turns the channel back
// into the selection. "Masked areas" (default) shows the overlay where nothing is selected; "selected areas" the
// reverse. Entering and leaving are one undo step each.

import type { AlphaChannel, ImageDocument } from "../document.ts";
import type { RGBA } from "../layers.ts";
import { Mask } from "../tiles.ts";
import type { ToolContext } from "./tool.ts";

export const QUICK_MASK_ID = "quickmask";

export interface QuickMaskOptions {
  /** Overlay color (default red). */
  color?: RGBA | undefined;
  /** Overlay opacity 0–1 (default 0.5). */
  opacity?: number | undefined;
  /** The overlay marks the masked (unselected, default) or the selected areas. */
  indicates?: "masked" | "selected" | undefined;
}

/** The temporary channel while the mode is on. */
export const quickMaskChannel = (doc: ImageDocument): AlphaChannel | null => doc.channels.find((c) => c.id === QUICK_MASK_ID) ?? null;

const indicatesOf = (doc: ImageDocument): "masked" | "selected" => (doc.meta.quickMaskIndicates === "selected" ? "selected" : "masked");

/** Turn quick mask mode on. The channel holds the overlay amount (255 = overlay shown). */
export function enterQuickMask(doc: ImageDocument, o: QuickMaskOptions = {}, ctx?: ToolContext): void {
  if (doc.quickMask) return;
  const indicates = o.indicates ?? indicatesOf(doc);
  doc.change("Quick Mask", () => {
    const m = new Mask(doc.width, doc.height), d = m.data, s = doc.selection?.data;
    // masked areas: overlay = 255 − selection; selected areas: overlay = selection
    if (indicates === "masked") { if (s) for (let i = 0; i < d.length; i++) d[i] = 255 - s[i]!; else d.fill(255); }
    else if (s) d.set(s);
    const ch: AlphaChannel = { id: QUICK_MASK_ID, name: "Quick Mask", mask: m, visible: true, color: o.color ?? [1, 0, 0, 1], opacity: o.opacity ?? 0.5 };
    doc.channels = [...doc.channels.filter((c) => c.id !== QUICK_MASK_ID), ch];
    doc.selection = null;
    doc.quickMask = true;
    doc.meta = { ...doc.meta, quickMaskIndicates: indicates };
  });
  if (ctx) ctx.shared.target = "quickmask";
}

/** Turn quick mask mode off: the channel becomes the selection. */
export function exitQuickMask(doc: ImageDocument, ctx?: ToolContext): void {
  if (!doc.quickMask) return;
  const ch = quickMaskChannel(doc), indicates = indicatesOf(doc);
  doc.change("Quick Mask", () => {
    if (ch) {
      const m = new Mask(doc.width, doc.height), d = m.data, q = ch.mask.data;
      if (indicates === "masked") for (let i = 0; i < d.length; i++) d[i] = 255 - q[i]!;
      else d.set(q);
      doc.selection = m.isEmpty() ? null : m;
    }
    doc.channels = doc.channels.filter((c) => c.id !== QUICK_MASK_ID);
    doc.quickMask = false;
  });
  if (ctx && ctx.shared.target === "quickmask") delete ctx.shared.target;
}

export function toggleQuickMask(doc: ImageDocument, o: QuickMaskOptions = {}, ctx?: ToolContext): boolean {
  if (doc.quickMask) exitQuickMask(doc, ctx);
  else enterQuickMask(doc, o, ctx);
  return doc.quickMask;
}

/** Quick Mask Options: color, opacity and what the overlay indicates (flips the channel when that changes). */
export function setQuickMaskOptions(doc: ImageDocument, o: QuickMaskOptions): void {
  doc.change("Quick Mask Options", () => {
    const ch = quickMaskChannel(doc), prev = indicatesOf(doc);
    if (o.indicates && o.indicates !== prev) {
      doc.meta = { ...doc.meta, quickMaskIndicates: o.indicates };
      if (ch) { const m = ch.mask.clone(), d = m.writable(); for (let i = 0; i < d.length; i++) d[i] = 255 - d[i]!; ch.mask = m; }
    }
    if (ch) doc.channels = doc.channels.map((c) => (c.id === QUICK_MASK_ID ? { ...c, mask: ch.mask, color: o.color ?? c.color, opacity: o.opacity ?? c.opacity } : c));
  });
}

/**
 * The mask a painting tool writes into, or null to paint pixels. A painted gray value v (0 black … 1 white) maps to the
 * channel as: masked areas → overlay = 1 − v (black paints mask); selected areas → overlay = v.
 */
export function paintTarget(doc: ImageDocument, ctx?: ToolContext): { mask: Mask; invert: boolean } | null {
  if (!doc.quickMask || (ctx && ctx.shared.target !== "quickmask")) return null;
  const ch = quickMaskChannel(doc);
  return ch ? { mask: ch.mask, invert: indicatesOf(doc) === "masked" } : null;
}

/** The overlay color and per-pixel alpha (0–1) of the quick mask for the view, over a region. */
export function quickMaskOverlay(doc: ImageDocument, r: { x: number; y: number; w: number; h: number }): { color: RGBA; alpha: Float32Array } | null {
  const ch = quickMaskChannel(doc);
  if (!ch || !doc.quickMask) return null;
  const a = new Float32Array(r.w * r.h), k = ch.opacity / 255;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) a[y * r.w + x] = ch.mask.get(r.x + x, r.y + y) * k;
  return { color: ch.color, alpha: a };
}
