// Splitter (hadi-march/ui): two resizable panes, side by side (horizontal) or stacked (vertical). Right-to-left aware:
// the start pane is on the right in RTL, so dragging and the arrow keys follow what the user sees.
import "./splitter.css";
import { signal, effect, untrack } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "./util.ts";
import { clamp, listen } from "../core/util.ts";
import { isRtl } from "./focus.ts";
const setVar = (el: Element, name: string, value: string): void => { (el as HTMLElement).style?.setProperty(name, value); };

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
  class?: ClassProp;
}
/** Two resizable panes (drag the handle, or the arrow keys / Home / End on it). */
export function Splitter(props: SplitterProps): Element {
  const vertical = props.orientation === "vertical";
  const share = signal(untrack(() => val(props.value)) ?? props.initial ?? 0.5), min = props.min ?? 0.15;
  let root: HTMLElement | undefined;
  const apply = (): void => { if (root) setVar(root, "--hm-split", `${(share.peek() * 100).toFixed(2)}%`); };
  const setShare = (v: number): void => { const n = clamp(v, min, 1 - min); if (n === share.peek()) return; share.set(n); apply(); props.onChange?.(n); };
  effect(() => { const v = val(props.value); if (v != null && v !== untrack(share)) { share.set(clamp(v, min, 1 - min)); apply(); } });
  const onDown = (e: PointerEvent): void => {
    const handle = e.currentTarget as HTMLElement; handle.setPointerCapture?.(e.pointerId);
    const rtl = isRtl(root);
    const move = (ev: PointerEvent): void => {
      if (!root) return;
      const r = root.getBoundingClientRect();
      setShare(vertical ? (ev.clientY - r.top) / r.height : rtl ? (r.right - ev.clientX) / r.width : (ev.clientX - r.left) / r.width);
    };
    const up = (): void => { root?.classList.remove("is-dragging"); off(); };
    root?.classList.add("is-dragging");
    const off = listen(handle, { pointermove: move, pointerup: up, pointercancel: up });
  };
  const onKey = (e: KeyboardEvent): void => {
    const back = vertical ? "ArrowUp" : isRtl(root) ? "ArrowRight" : "ArrowLeft";
    const fwd = vertical ? "ArrowDown" : isRtl(root) ? "ArrowLeft" : "ArrowRight";
    const step = e.shiftKey ? 0.15 : 0.05;
    const next = e.key === back ? share.peek() - step : e.key === fwd ? share.peek() + step : e.key === "Home" ? min : e.key === "End" ? 1 - min : null;
    if (next == null) return;
    e.preventDefault(); setShare(next);
  };
  return h("div", { class: () => cx("hm-splitter", vertical && "hm-splitter-v", val(props.class)), ref: (x: HTMLElement) => { root = x; queueMicrotask(apply); } },
    h("div", { class: "hm-split-pane" }, props.start),
    h("div", {
      class: "hm-split-handle", role: "separator", tabindex: "0", "aria-orientation": vertical ? "horizontal" : "vertical", "aria-label": props.label ?? t`Resize`,
      "aria-valuenow": () => String(Math.round(share() * 100)), "aria-valuemin": "0", "aria-valuemax": "100",
      onPointerdown: onDown, onKeydown: onKey,
    }),
    h("div", { class: "hm-split-pane" }, props.end));
}
