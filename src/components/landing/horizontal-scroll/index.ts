// HorizontalScroll (hadi-march/landing): a pinned section whose panels move sideways while the page scrolls down — the
// vertical scroll distance equals the track's overflow, so the last panel arrives as the section ends. A progress line
// under the panels follows. RTL moves the other way. On touch screens and with reduced motion it becomes a native
// horizontal scroller with snap points (no pinning).
import "./horizontal-scroll.css";
import { h } from "../../../dom/h.ts";
import { signal } from "../../../core/reactive.ts";
import { cx, val, setStyle, clamp, isRtl, type ClassProp } from "../../../ui/util.ts";
import { owned, observeSize } from "../../../ui/observe.ts";
import { Progress } from "../../feedback/progress/index.ts";
import { reducedMotion } from "../../../motion/engine/prefs.ts";
import { onScrollProgress } from "../../../motion/scroll-fx.ts";

export interface HorizontalScrollProps {
  /** Panel width (CSS length, default min(80vw, 32rem)). */
  panel?: string | undefined;
  /** Accessible name of the region. */
  label?: string | undefined;
  /** The progress line under the panels (default true). */
  progress?: boolean | undefined;
  /** Pin the section and move the panels with the page scroll (default true); false: always a native sideways scroller with snap points. */
  pinned?: boolean | undefined;
  class?: ClassProp | undefined;
  children?: unknown;
}

const native = (): boolean => reducedMotion() || !!globalThis.matchMedia?.("(hover: none)").matches;

/** `<HorizontalScroll label="Case studies"><Card/><Card/><Card/></HorizontalScroll>` */
export function HorizontalScroll(props: HorizontalScrollProps): Element {
  const track = h("div", { class: "hm-hs-track" }, props.children) as HTMLElement;
  const done = signal(0); // 0..1 of the pinned passage: the Progress line under the panels shows it
  const pin = h("div", { class: "hm-hs-pin" }, h("div", { class: "hm-hs-view" }, track),
    props.progress === false ? null : h(Progress, { variant: "line", decorative: true, smooth: false, value: done, max: 1, class: "hm-hs-bar" })) as HTMLElement;
  const root = h("section", { class: cx("hm-hs", val(props.class)), "aria-label": props.label ?? null, role: props.label ? "region" : null }, pin) as HTMLElement;
  if (props.panel) setStyle(root, { "--hm-hs-panel": props.panel });

  let overflow = 0;
  const size = (): void => {
    const nat = props.pinned === false || native();
    root.classList.toggle("is-native", nat);
    overflow = nat ? 0 : Math.max(0, track.scrollWidth - pin.clientWidth);
    // the section is as tall as the sideways distance plus one screen
    setStyle(root, { "--hm-hs-extra": `${overflow}px` });
  };
  if (globalThis.ResizeObserver) { observeSize(track, size); observeSize(pin, size); }
  queueMicrotask(size);
  // the pinned passage (section top at the viewport top → section end at the viewport bottom) from the motion scroll core
  owned(onScrollProgress({ track: root }, () => {
    if (props.pinned === false || native() || !overflow) { setStyle(track, { transform: null }); done.set(0); return; }
    const r = root.getBoundingClientRect(), vh = globalThis.innerHeight || 1;
    const at = clamp(-r.top / Math.max(1, r.height - vh), 0, 1);
    setStyle(track, { transform: `translate3d(${(at * overflow * (isRtl(root) ? 1 : -1)).toFixed(1)}px, 0, 0)` });
    done.set(at);
  }));
  return root;
}
