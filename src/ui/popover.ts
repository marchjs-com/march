// Floating panels (menus, dropdowns, tooltips): positioned next to an anchor with a style OBJECT (CSSOM; CSP safe),
// flipped when they would leave the viewport, closed on outside pointer, Escape, scroll and resize.
import { signal, onCleanup } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { Portal } from "../dom/portal.ts";
import { on, cx } from "./util.ts";
import { clamp } from "../core/util.ts";
import { dismiss } from "../behaviors/dismiss/index.ts";

export type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end" | "top" | "bottom";
/** Fixed position as a style object. */
export interface PlacedStyle { top: string; left: string; "min-width"?: string | null }

/** Compute a fixed position for `panel` next to `anchor`. */
export function place(anchor: Element, panel: Element | null | undefined, placement: Placement = "bottom-start", gap = 6): PlacedStyle {
  const a = anchor.getBoundingClientRect();
  const p = panel?.getBoundingClientRect?.() ?? { width: 0, height: 0 };
  const vw = globalThis.innerWidth ?? 1024, vh = globalThis.innerHeight ?? 768;
  const parts = placement.split("-");
  let side = parts[0];
  const align = parts[1] ?? "center";
  if (side === "bottom" && a.bottom + gap + p.height > vh && a.top - gap - p.height >= 0) side = "top";
  else if (side === "top" && a.top - gap - p.height < 0) side = "bottom";
  const top = side === "bottom" ? a.bottom + gap : a.top - gap - p.height;
  let left = align === "start" ? a.left : align === "end" ? a.right - p.width : a.left + (a.width - p.width) / 2;
  left = clamp(vw - p.width - 8, 8, left);
  return { top: `${Math.round(top)}px`, left: `${Math.round(left)}px`, "min-width": align === "center" ? null : `${Math.round(a.width)}px` };
}

export interface FloatingOptions {
  anchor: Element | undefined;
  placement?: Placement;
  /** Called on outside pointer (no argument) and Escape (`true`: return focus to the trigger). */
  onClose: (refocus?: boolean) => void;
  class?: string;
  role?: string | null;
  id?: string;
  children: unknown;
  attrs?: Record<string, unknown>;
  ref?: (el: HTMLElement) => void;
}

/** Render a floating panel in a Portal. Call inside a reactive branch that exists only while open. */
export function floating(o: FloatingOptions): unknown {
  const pos = signal<PlacedStyle>({ top: "0px", left: "0px" });
  let panel: HTMLElement | undefined;
  const update = (): void => { if (panel && o.anchor) pos.set(place(o.anchor, panel, o.placement)); };
  // the panel lives in a Portal: carry over the anchor's color token and theme so it looks like its control
  const scoped = (attr: string): string | null => o.anchor?.closest?.(`[${attr}]`)?.getAttribute(attr) ?? null;
  const el = h("div", { ...(o.attrs ?? {}), class: cx("hm-pop", o.class), role: o.role, id: o.id, "data-hm-color": scoped("data-hm-color"), "data-hm-theme": scoped("data-hm-theme"),
    style: () => pos(), ref: (x: HTMLElement) => { panel = x; o.ref?.(x); } }, o.children);
  update();
  const raf = globalThis.requestAnimationFrame?.(update);
  onCleanup(() => globalThis.cancelAnimationFrame?.(raf as number));
  // a press outside (panel and anchor are inside) or Escape (capture: the innermost popover first) closes it
  dismiss(() => panel, { inside: () => [o.anchor], onDismiss: (why) => (why === "escape" ? o.onClose(true) : o.onClose()) });
  on(globalThis.window, "resize", update);
  on(globalThis.window, "scroll", update, true);
  return h(Portal, { layer: o.role === "tooltip" ? "tooltip" : o.role === "menu" || o.role === "listbox" ? "menu" : "popover", children: el });
}
