// The hint of m:tip (hadi-march/props): Tooltip's bubble on an element that is already there, no wrapper. Loaded by
// the common prop the first time one is used. Folder: src/components/overlays/tooltip/.
import "../../actions/menu/menu.css";
import "./tooltip.css";
import { signal, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { floating, type Placement } from "../../../ui/popover.ts";
import { uid, debounce } from "../../../ui/util.ts";

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
  const on: [string, (e: Event) => void][] = [["mouseenter", open], ["mouseleave", hide], ["focusin", focus], ["focusout", hide], ["keydown", key]];
  for (const [n, f] of on) el.addEventListener(n, f);
  onCleanup(() => { hide(); for (const [n, f] of on) el.removeEventListener(n, f); });
  effect(() => {
    const t = text();
    if (!show() || !t) { el.removeAttribute("aria-describedby"); return; }
    el.setAttribute("aria-describedby", id);
    untrack(() => floating({ anchor: el as HTMLElement, placement: o.placement ?? "top", role: "tooltip", id, onClose: hide, children: () => text(), class: "m-tooltip" }));
  });
}
