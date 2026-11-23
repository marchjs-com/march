// The hint of m:tip (march/props): Tooltip's bubble on an element that is already there, no wrapper. Loaded by
// the common prop the first time one is used. Folder: src/components/overlays/tooltip/.
import "../../actions/menu/menu.css";
import "./tooltip.css";
import { signal, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { floating, type Placement } from "../../../ui/popover.ts";
import { uid, debounce } from "../../../ui/util.ts";

/** Add / remove the hint's id in `aria-describedby`, keeping the ids already there (a field's help or error text). */
export function describedBy(el: Element, id: string, on: boolean): void {
  const ids = (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter((x) => x && x !== id);
  if (on) ids.push(id);
  if (ids.length) el.setAttribute("aria-describedby", ids.join(" "));
  else el.removeAttribute("aria-describedby");
}

/**
 * Shows `text()` above `el` on hover (after `delay` ms) and at once on keyboard focus, linked with aria-describedby;
 * Escape hides it. Cleans up with the current owner.
 */
export function tip(el: Element, text: () => string, o: { placement?: Placement; delay?: number } = {}): void {
  const show = signal(false), id = uid("m-tip");
  const open = debounce(() => { show.set(true); }, o.delay ?? 300);
  const hide = (): void => { open.cancel(); show.set(false); };
  const focus = (): void => { show.set(true); };
  const key = (e: Event): void => { if ((e as KeyboardEvent).key === "Escape") hide(); };
  const on: [string, (e: Event) => void][] = [["pointerenter", open], ["pointerleave", hide], ["focusin", focus], ["focusout", hide], ["keydown", key]];
  for (const [n, f] of on) el.addEventListener(n, f);
  onCleanup(() => { hide(); for (const [n, f] of on) el.removeEventListener(n, f); });
  effect(() => {
    const t = text();
    if (!show() || !t) { describedBy(el, id, false); return; }
    describedBy(el, id, true);
    untrack(() => floating({ anchor: el as HTMLElement, placement: o.placement ?? "top", role: "tooltip", id, onClose: hide, children: () => text(), class: "m-tooltip" }));
  });
}
