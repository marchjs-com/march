// Floating panels (menus, dropdowns, tooltips): positioned next to an anchor with a style OBJECT (CSSOM; CSP safe),
// flipped when they would leave the viewport, closed on outside pointer, Escape, scroll and resize.
import { signal, onCleanup } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { Portal } from "../dom/portal.ts";
import { on, cx } from "./util.ts";
import { clamp } from "../core/util.ts";
import { dismiss } from "../behaviors/dismiss/index.ts";

export type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end" | "top" | "bottom" | "right-start";
/** Fixed position as a style object. */
export interface PlacedStyle { top: string; left: string; "min-width"?: string | null }

/** Compute a fixed position for `panel` next to `anchor`. */
export function place(anchor: Element, panel: Element | null | undefined, placement: Placement = "bottom-start", gap = 6): PlacedStyle {
  // the laid-out size: an entrance that scales the panel must not shrink the box it is placed by
  const box = panel?.getBoundingClientRect?.() ?? { width: 0, height: 0 }, own = panel as HTMLElement | null | undefined;
  const p = { width: own?.offsetWidth || box.width, height: own?.offsetHeight || box.height };
  // inside an <OverlayScope> (a preview, a panel) the panel is placed by the scope's box: its fixed position is
  // relative to the scope, and it stays inside it
  const scope = (panel ?? anchor).closest?.(".m-overlay-scope")?.getBoundingClientRect();
  const ox = scope?.left ?? 0, oy = scope?.top ?? 0;
  // the page's visible box, without a classic scrollbar (innerWidth counts it: a panel at the end edge would sit under it)
  const de = globalThis.document?.documentElement;
  const vw = scope?.width ?? (de?.clientWidth || globalThis.innerWidth || 1024), vh = scope?.height ?? (de?.clientHeight || globalThis.innerHeight || 768);
  const r = anchor.getBoundingClientRect();
  const a = { top: r.top - oy, bottom: r.bottom - oy, left: r.left - ox, right: r.right - ox, width: r.width };
  // beside the anchor, its top level with the anchor's (a sub-menu): on the left when there is no room on the right
  if (placement === "right-start") {
    let x = a.right + gap;
    if (x + p.width > vw - 8) x = a.left - gap - p.width;
    return { top: `${Math.round(clamp(vh - p.height - 8, 8, a.top))}px`, left: `${Math.round(clamp(vw - p.width - 8, 8, x))}px`, "min-width": null };
  }
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
  const el = h("div", { ...(o.attrs ?? {}), class: cx("m-pop", o.class), role: o.role, id: o.id, "data-m-color": scoped("data-m-color"), "data-m-theme": scoped("data-m-theme"),
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

/**
 * A rectangle that stands in for an anchor element: the caret, the selected text, a point. `rect` is read on every
 * placement; while it is empty the box of `fallback()` (else of the host) is used. `host` is the element the
 * rectangle lives in: presses inside it (or inside the fallback) count as "inside the anchor".
 * `<Popover anchor={() => virtualAnchor(() => range.getBoundingClientRect(), () => editor)} … />`
 */
export function virtualAnchor(rect: () => DOMRect | null | undefined, host: () => Element, fallback?: () => Element | null | undefined): Element {
  const other = (): Element => fallback?.() ?? host();
  return {
    getBoundingClientRect: (): DOMRect => { const r = rect(); return r && (r.width || r.height) ? r : other().getBoundingClientRect(); },
    contains: (n: Node | null) => host().contains(n) || other().contains(n),
    closest: (sel: string) => host().closest(sel),
  } as unknown as Element;
}
