// Tooltip (march/ui): a short hint on hover and keyboard focus, linked with aria-describedby.
// Folder: src/components/overlays/tooltip/.
import "../../actions/menu/menu.css";
import "./tooltip.css";
import { signal, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { floating, type Placement } from "../../../ui/popover.ts";
import { val, uid, cx, debounce, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { describedBy } from "./tip.ts";

export interface TooltipProps {
  /** The hint text. @tr İpucu metni. */
  text: MaybeFn<string>;
  /** Preferred side (default top). @tr Tercih edilen yön (varsayılan top). */
  placement?: Placement;
  /** Hover delay before it shows, ms (default 300; keyboard focus shows it at once). @tr Görünmeden önce üzerine gelme gecikmesi, ms (varsayılan 300; klavye odağı hemen gösterir). */
  delay?: number | undefined;
  /** true: it never shows (the wrapped element works as before). @tr true: hiç görünmez (sarılan öğe eskisi gibi çalışır). */
  disabled?: MaybeFn<boolean | undefined>;
  /** Entrance motion: "scale" (default), "fade" or "none". @tr Giriş hareketi: "scale" (varsayılan), "fade" ya da "none". */
  motion?: "scale" | "fade" | "none" | undefined;
  /** Theme color token of the bubble (default: the inverse surface). @tr Balonun tema renk belirteci (varsayılan: ters yüzey). */
  color?: ColorToken | undefined;
  /** Extra class on the bubble. @tr Balona eklenen sınıf. */
  class?: ClassProp;
  /** The element the hint belongs to. @tr İpucunun ait olduğu öğe. */
  children?: unknown;
}
/** `<Tooltip text="Copy link" placement="top"><button>…</button></Tooltip>` — on hover and keyboard focus. */
export function Tooltip(props: TooltipProps): unknown[] {
  const show = signal(false);
  const id = uid("m-tip");
  let anchor: HTMLElement | undefined;
  const off = (): boolean => !!val(props.disabled);
  const open = debounce(() => { if (!off()) show.set(true); }, props.delay ?? 300);
  const hide = (): void => { open.cancel(); show.set(false); };
  onCleanup(() => open.cancel());
  const wrap = h("span", {
    class: "m-tip-anchor", ref: (x: HTMLElement) => { anchor = x; },
    onMouseenter: open, onMouseleave: hide, onFocusin: () => { if (!off()) show.set(true); }, onFocusout: hide,
    onKeydown: (e: KeyboardEvent) => { if (e.key === "Escape") hide(); },
  }, props.children);
  const target = (): Element => (anchor as HTMLElement).firstElementChild ?? (anchor as HTMLElement);
  return [wrap, () => {
    const on = show() && !off();
    untrack(() => describedBy(target(), id, on));
    return on && untrack(() => {
      const color = colorAttr(props.color), motion = props.motion;
      return floating({
        anchor, placement: props.placement ?? "top", role: "tooltip", id, onClose: hide, children: () => val(props.text),
        class: cx("m-tooltip", color && "m-tooltip-colored", motion === "fade" && "m-tooltip-fade", motion === "none" && "m-tooltip-still", val(props.class)),
        // the bubble's own color (the panel otherwise takes the color scope of its anchor)
        ...(color ? { ref: (x: HTMLElement) => x.setAttribute("data-m-color", color) } : {}),
      });
    });
  }];
}
