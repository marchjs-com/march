// OverlayScope (hadi-march/layout): a box that layers opened inside it open in. A drawer, a dialog, a menu or a toast
// of a site preview, a device frame, a dashboard panel or a demo stays in it instead of covering the whole page:
// fixed-positioned overlays cover the box (it is their containing block), a modal one makes only the box inert, and
// openDialog / openDrawer / <Portal layer> find it by themselves (target: "page" opens on the page anyway).
//
//   <OverlayScope class="preview"><MySite /></OverlayScope>
//   openDrawer(render, { target: "page" })      // this one covers the page
import "./overlay-scope.css";
import { h, insert } from "../../../dom/h.ts";
import { context, provide, useContext } from "../../../core/reactive.ts";
import { _setScopeOf } from "../../../dom/portal.ts";
import { cx, val, type ClassProp, type MaybeFn } from "../../../ui/util.ts";

/** The overlay scope around this code (an <OverlayScope>). */
export const OverlayScopeContext = context<HTMLElement | null>(null);

/** The scope a layer opened now belongs in: the <OverlayScope> around the calling component, else the one around
 *  `from` (or the focused element: a click handler runs outside any component), else the page (null). */
export function overlayScopeFor(from?: Element | null): HTMLElement | null {
  return useContext(OverlayScopeContext) ?? ((from ?? globalThis.document?.activeElement)?.closest?.(".hm-overlay-scope") as HTMLElement | null) ?? null;
}
// <Portal layer> and the layer stack ask this when a layer opens
_setScopeOf(() => overlayScopeFor());

export interface OverlayScopeProps { class?: MaybeFn<ClassProp>; children?: unknown }

/** A box that keeps the layers opened inside it (drawers, dialogs, menus, toasts) inside it. */
export function OverlayScope(props: OverlayScopeProps): Element {
  const el = h("div", { class: () => cx("hm-overlay-scope", val(props.class)) }) as HTMLElement;
  // CSSOM (CSP-safe): positioned, and the containing block of its fixed descendants
  el.style.setProperty("position", "relative");
  el.style.setProperty("contain", "layout");
  provide(OverlayScopeContext, el);
  insert(el, () => props.children);
  return el;
}
