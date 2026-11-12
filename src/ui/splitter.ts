// Splitter (hadi-march/ui).
import "./splitter.css";
import { signal } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { val, cx, type ClassProp } from "./util.ts";
import { clamp } from "../core/util.ts";
const setVar = (el: Element, name: string, value: string): void => { (el as HTMLElement).style?.setProperty(name, value); };

export interface SplitterProps { start: unknown; end: unknown; /** Initial share of the first pane, 0..1. */ initial?: number; min?: number; label?: string; class?: ClassProp }
/** Two resizable panes (drag the handle, or ← → on it). */
export function Splitter(props: SplitterProps): Element {
  const share = signal(props.initial ?? 0.5), min = props.min ?? 0.15;
  let root: HTMLElement | undefined;
  const apply = (): void => { if (root) setVar(root, "--hm-split", `${(share.peek() * 100).toFixed(2)}%`); };
  const setShare = (v: number): void => { share.set(clamp(v, min, 1 - min)); apply(); };
  const onDown = (e: PointerEvent): void => {
    const handle = e.currentTarget as HTMLElement; handle.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent): void => { if (!root) return; const r = root.getBoundingClientRect(); setShare((ev.clientX - r.left) / r.width); };
    const up = (): void => { handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); };
    handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", up);
  };
  const el = h("div", { class: () => cx("hm-splitter", val(props.class)), ref: (x: HTMLElement) => { root = x; queueMicrotask(apply); } },
    h("div", { class: "hm-split-pane" }, props.start),
    h("div", {
      class: "hm-split-handle", role: "separator", tabindex: "0", "aria-orientation": "vertical", "aria-label": props.label ?? t`Resize`,
      "aria-valuenow": () => String(Math.round(share() * 100)), "aria-valuemin": "0", "aria-valuemax": "100",
      onPointerdown: onDown, onKeydown: (e: KeyboardEvent) => { const d = e.key === "ArrowLeft" ? -0.05 : e.key === "ArrowRight" ? 0.05 : 0; if (d) { e.preventDefault(); setShare(share.peek() + d); } },
    }),
    h("div", { class: "hm-split-pane" }, props.end));
  return el;
}
