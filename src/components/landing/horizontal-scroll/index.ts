// HorizontalScroll (hadi-march/landing): a pinned section whose panels move sideways while the page scrolls down — the
// vertical scroll distance equals the track's overflow, so the last panel arrives as the section ends. A progress line
// under the panels follows. RTL moves the other way. On touch screens and with reduced motion it becomes a native
// horizontal scroller with snap points (no pinning).
import "./horizontal-scroll.css";
import { h } from "../../../dom/h.ts";
import { onCleanup, getOwner } from "../../../core/reactive.ts";
import { cx, val, setStyle, type ClassProp } from "../../../ui/util.ts";
import { reducedMotion } from "../../../motion/engine/prefs.ts";
import { scrollScene } from "../../../motion/scroll-scene.ts";

export interface HorizontalScrollProps {
  /** Panel width (CSS length, default min(80vw, 32rem)). */
  panel?: string | undefined;
  /** Accessible name of the region. */
  label?: string | undefined;
  class?: ClassProp | undefined;
  children?: unknown;
}

const native = (): boolean => reducedMotion() || !!globalThis.matchMedia?.("(hover: none)").matches;

/** `<HorizontalScroll label="Case studies"><Card/><Card/><Card/></HorizontalScroll>` */
export function HorizontalScroll(props: HorizontalScrollProps): Element {
  const track = h("div", { class: "hm-hs-track" }, props.children) as HTMLElement;
  const bar = h("span", { class: "hm-hs-bar-fill" }) as HTMLElement;
  const pin = h("div", { class: "hm-hs-pin" }, h("div", { class: "hm-hs-view" }, track), h("span", { class: "hm-hs-bar", "aria-hidden": "true" }, bar)) as HTMLElement;
  const root = h("section", { class: cx("hm-hs", val(props.class)), "aria-label": props.label ?? null, role: props.label ? "region" : null }, pin) as HTMLElement;
  if (props.panel) setStyle(root, { "--hm-hs-panel": props.panel });

  let overflow = 0;
  const size = (): void => {
    const nat = native();
    root.classList.toggle("is-native", nat);
    overflow = nat ? 0 : Math.max(0, track.scrollWidth - pin.clientWidth);
    // the section is as tall as the sideways distance plus one screen
    setStyle(root, { "--hm-hs-extra": `${overflow}px` });
  };
  const RO = globalThis.ResizeObserver;
  if (RO) { const ro = new RO(size); ro.observe(track); ro.observe(pin); if (getOwner()) onCleanup(() => ro.disconnect()); }
  queueMicrotask(size);
  scrollScene(root, (s) => {
    if (native() || !overflow) { setStyle(track, { transform: null }); setStyle(bar, { transform: null }); return; }
    const rtl = globalThis.getComputedStyle?.(root).direction === "rtl";
    const x = s.pin * overflow * (rtl ? 1 : -1);
    setStyle(track, { transform: `translate3d(${x.toFixed(1)}px, 0, 0)` });
    setStyle(bar, { transform: `scaleX(${s.pin.toFixed(4)})` });
  });
  return root;
}
