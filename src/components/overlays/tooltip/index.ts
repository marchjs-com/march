// Tooltip (hadi-march/ui): a short hint on hover and keyboard focus, linked with aria-describedby.
// Folder: src/components/overlays/tooltip/.
import "../../actions/menu/menu.css";
import "./tooltip.css";
import { signal, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { floating, type Placement } from "../../../ui/popover.ts";
import { val, uid, debounce, type MaybeFn } from "../../../ui/util.ts";

export interface TooltipProps { text: MaybeFn<string>; placement?: Placement; children?: unknown }
/** `<Tooltip text="Copy link" placement="top"><button>…</button></Tooltip>` — on hover and keyboard focus. */
export function Tooltip(props: TooltipProps): unknown[] {
  const show = signal(false);
  const id = uid("hm-tip");
  let anchor: HTMLElement | undefined;
  const open = debounce(() => show.set(true), 300);
  const hide = (): void => { open.cancel(); show.set(false); };
  const wrap = h("span", {
    class: "hm-tip-anchor", ref: (x: HTMLElement) => { anchor = x; },
    onMouseenter: open, onMouseleave: hide, onFocusin: () => show.set(true), onFocusout: hide,
    onKeydown: (e: KeyboardEvent) => { if (e.key === "Escape") hide(); },
  }, props.children);
  const target = (): Element => (anchor as HTMLElement).firstElementChild ?? (anchor as HTMLElement);
  return [wrap, () => {
    const on = show();
    untrack(() => (on ? target().setAttribute("aria-describedby", id) : target().removeAttribute("aria-describedby")));
    return on && untrack(() => floating({ anchor, placement: props.placement ?? "top", role: "tooltip", id, class: "hm-tooltip", onClose: hide, children: () => val(props.text) }));
  }];
}
