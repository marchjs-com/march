// Splitter (hadi-march/ui).
import "./splitter.css";
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type ClassProp } from "../../../ui/util.ts";
import { clamp, setStyle } from "../../../core/util.ts";
import { resizeHandle } from "../../../behaviors/resize-handle/index.ts";

export interface SplitterProps { start: unknown; end: unknown; /** Initial share of the first pane, 0..1. */ initial?: number; min?: number; label?: string; class?: ClassProp }
/** Two resizable panes (drag the handle, or ← → on it). */
export function Splitter(props: SplitterProps): Element {
  const share = signal(props.initial ?? 0.5), min = props.min ?? 0.15;
  let root: HTMLElement | undefined;
  const apply = (): void => { if (root) setStyle(root, { "--hm-split": `${(share.peek() * 100).toFixed(2)}%` }); };
  const setShare = (v: number): void => { share.set(clamp(v, min, 1 - min)); apply(); };
  const el = h("div", { class: () => cx("hm-splitter", val(props.class)), ref: (x: HTMLElement) => { root = x; queueMicrotask(apply); } },
    h("div", { class: "hm-split-pane" }, props.start),
    h("div", {
      class: "hm-split-handle", "aria-label": props.label ?? t`Resize`,
      // drag, arrows (RTL mirrored), Home / End, Enter resets: the resize-handle behavior; the value is a percent
      ref: (x: HTMLElement) => resizeHandle(x, {
        value: () => share.peek() * 100, set: (v) => setShare(v / 100), min: min * 100, max: 100 - min * 100, step: 5,
        scale: () => 100 / (root?.getBoundingClientRect().width || 100), reset: () => setShare(props.initial ?? 0.5),
      }),
    }),
    h("div", { class: "hm-split-pane" }, props.end));
  return el;
}
