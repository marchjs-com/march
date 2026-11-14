// HorizontalScroll (hadi-march/landing): a pinned section whose panels move sideways while the page scrolls down — the
// vertical scroll distance equals the track's overflow, so the last panel arrives as the section ends. A progress line
// under the panels follows. RTL moves the other way. On touch screens and with reduced motion it becomes a native
// horizontal scroller with snap points (no pinning).
import "./horizontal-scroll.css";
import { h } from "../../../dom/h.ts";
import { onCleanup, getOwner } from "../../../core/reactive.ts";
import { cx, val, setStyle, clamp, type ClassProp } from "../../../ui/util.ts";
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
  const bar = h("span", { class: "hm-hs-bar-fill" }) as HTMLElement;
  const pin = h("div", { class: "hm-hs-pin" }, h("div", { class: "hm-hs-view" }, track), props.progress === false ? null : h("span", { class: "hm-hs-bar", "aria-hidden": "true" }, bar)) as HTMLElement;
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
  const RO = globalThis.ResizeObserver;
  if (RO) { const ro = new RO(size); ro.observe(track); ro.observe(pin); if (getOwner()) onCleanup(() => ro.disconnect()); }
  queueMicrotask(size);
  // the pinned passage (section top at the viewport top → section end at the viewport bottom) from the motion scroll core
  const offScroll = onScrollProgress({ track: root }, () => {
    if (props.pinned === false || native() || !overflow) { setStyle(track, { transform: null }); setStyle(bar, { transform: null }); return; }
    const r = root.getBoundingClientRect(), vh = globalThis.innerHeight || 1;
    const pin = clamp(-r.top / Math.max(1, r.height - vh), 0, 1);
    const rtl = globalThis.getComputedStyle?.(root).direction === "rtl";
    setStyle(track, { transform: `translate3d(${(pin * overflow * (rtl ? 1 : -1)).toFixed(1)}px, 0, 0)` });
    setStyle(bar, { transform: `scaleX(${pin.toFixed(4)})` });
  });
  if (getOwner()) onCleanup(offScroll);
  return root;
}
