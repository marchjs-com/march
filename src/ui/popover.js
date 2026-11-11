// Floating panels (menus, dropdowns, tooltips): positioned next to an anchor with a style OBJECT (CSSOM; CSP safe),
// flipped when they would leave the viewport, closed on outside pointer, Escape, scroll and resize.
import { signal, onCleanup } from "../core/reactive.js";
import { h } from "../dom/h.js";
import { Portal } from "../dom/flow.js";
import { on, cx } from "./util.js";

/**
 * Compute a fixed position for `panel` next to `anchor`.
 * @param {"bottom-start"|"bottom-end"|"top-start"|"top-end"|"top"|"bottom"} placement
 */
export function place(anchor, panel, placement = "bottom-start", gap = 6) {
  const a = anchor.getBoundingClientRect();
  const p = panel?.getBoundingClientRect?.() ?? { width: 0, height: 0 };
  const vw = globalThis.innerWidth ?? 1024, vh = globalThis.innerHeight ?? 768;
  let [side, align = "center"] = placement.split("-");
  if (side === "bottom" && a.bottom + gap + p.height > vh && a.top - gap - p.height >= 0) side = "top";
  else if (side === "top" && a.top - gap - p.height < 0) side = "bottom";
  const top = side === "bottom" ? a.bottom + gap : a.top - gap - p.height;
  let left = align === "start" ? a.left : align === "end" ? a.right - p.width : a.left + (a.width - p.width) / 2;
  left = Math.max(8, Math.min(left, vw - p.width - 8));
  return { top: `${Math.round(top)}px`, left: `${Math.round(left)}px`, "min-width": align === "center" ? null : `${Math.round(a.width)}px` };
}

/**
 * Render a floating panel in a Portal. Call inside a reactive branch that exists only while open.
 * @param {{ anchor: Element, placement?: string, onClose: () => void, class?: string, role?: string, id?: string,
 *           children: any, attrs?: object, ref?: (el: Element) => void }} o
 */
export function floating(o) {
  const pos = signal({ top: "0px", left: "0px" });
  let panel;
  const update = () => { if (panel && o.anchor) pos.set(place(o.anchor, panel, o.placement)); };
  const el = h("div", { ...(o.attrs ?? {}), class: cx("hm-pop", o.class), role: o.role, id: o.id, style: () => pos(), ref: (x) => { panel = x; o.ref?.(x); } }, o.children);
  update();
  const raf = globalThis.requestAnimationFrame?.(update);
  onCleanup(() => globalThis.cancelAnimationFrame?.(raf));
  const d = globalThis.document;
  on(d, "pointerdown", (e) => { if (!panel.contains(e.target) && !o.anchor?.contains(e.target)) o.onClose(); }, true);
  // capture phase: Escape closes the innermost popover before a dialog underneath sees it
  on(d, "keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); o.onClose(true); } }, true);
  on(globalThis.window, "resize", update);
  on(globalThis.window, "scroll", update, true);
  return h(Portal, { children: el });
}
