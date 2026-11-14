// Splitter (hadi-march/ui): two resizable panes, side by side (horizontal) or stacked (vertical). Right-to-left aware:
// the start pane is on the right in RTL, so dragging and the arrow keys follow what the user sees.
import "./splitter.css";
import { signal, effect, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { clamp, setStyle } from "../../../core/util.ts";
import { resizeHandle } from "../../../behaviors/resize-handle/index.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

export interface SplitterProps {
  start: unknown;
  end: unknown;
  /** Initial share of the first pane, 0..1. */
  initial?: number;
  /** Controlled share of the first pane (0..1); with `onChange` the parent owns it. */
  value?: MaybeFn<number | undefined>;
  /** Called with the new share while dragging or on the keyboard. */
  onChange?: (share: number) => void;
  /** "horizontal": panes side by side (default); "vertical": stacked. */
  orientation?: "horizontal" | "vertical";
  /** Smallest share of either pane (default 0.15). */
  min?: number;
  label?: string;
  /** The handle: true (default, a line), false (fixed panes with a plain divider), or your own grip drawn on the line. */
  handle?: boolean | unknown;
  /** Colour of the handle while hovered, focused or dragged (default: the accent). */
  color?: ColorToken;
  class?: ClassProp;
}
/** Two resizable panes (drag the handle, or the arrow keys / Home / End on it; Enter resets). */
export function Splitter(props: SplitterProps): Element {
  const vertical = props.orientation === "vertical";
  const min = props.min ?? 0.15;
  // the first share keeps to the limits too (an initial 35 % with min 40 % starts at 40 %)
  const share = signal(clamp(untrack(() => val(props.value)) ?? props.initial ?? 0.5, min, 1 - min));
  let root: HTMLElement | undefined;
  const apply = (): void => { if (root) setStyle(root, { "--hm-split": `${(share.peek() * 100).toFixed(2)}%` }); };
  const setShare = (v: number): void => { const n = clamp(v, min, 1 - min); if (n === share.peek()) return; share.set(n); apply(); props.onChange?.(n); };
  effect(() => { const v = val(props.value); if (v != null && v !== untrack(share)) { share.set(clamp(v, min, 1 - min)); apply(); } });
  const size = (): number => { const r = root?.getBoundingClientRect(); return (vertical ? r?.height : r?.width) || 100; };
  return h("div", { class: () => cx("hm-splitter", vertical && "hm-splitter-v", val(props.class)), ref: (x: HTMLElement) => { root = x; queueMicrotask(apply); } },
    h("div", { class: "hm-split-pane" }, props.start),
    props.handle === false
      ? h("div", { class: "hm-split-handle is-fixed", role: "separator", "aria-orientation": vertical ? "horizontal" : "vertical" })
      : h("div", {
        class: "hm-split-handle", "aria-label": props.label ?? t`Resize`, "data-hm-color": colorAttr(props.color),
        // drag, arrows (RTL mirrored), Home / End, Enter resets: the resize-handle behavior; the value is a percent
        ref: (x: HTMLElement) => resizeHandle(x, {
          value: () => share.peek() * 100, set: (v) => setShare(v / 100), min: min * 100, max: 100 - min * 100, step: 5,
          axis: vertical ? "block" : "inline", scale: () => 100 / size(), reset: () => setShare(props.initial ?? 0.5),
          onStart: () => root?.classList.add("is-dragging"), onEnd: () => root?.classList.remove("is-dragging"),
        }),
      }, props.handle != null && props.handle !== true ? h("span", { class: "hm-split-grip", "aria-hidden": "true" }, props.handle) : null),
    h("div", { class: "hm-split-pane" }, props.end));
}
