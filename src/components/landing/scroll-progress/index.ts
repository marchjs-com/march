// ScrollProgress (hadi-march/landing): a thin bar that fills as the page (or one article) is read. Fixed to the top or
// placed inline; brand gradient or the accent; a transform (scaleX) written in the scroll scene's write phase. RTL fills
// from the right. It is a progressbar for assistive technology, with the percentage as its value.
import "./scroll-progress.css";
import { h } from "../../../dom/h.ts";
import { signal } from "../../../core/reactive.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, setStyle, type ClassProp } from "../../../ui/util.ts";
import { scrollScene } from "../../../motion/scroll-scene.ts";

export interface ScrollProgressProps {
  /** Measure this element (an article) instead of the whole page. */
  target?: (() => Element | null) | undefined;
  /** fixed (top of the viewport, default) or inline. */
  position?: "fixed" | "inline" | undefined;
  /** gradient (brand colours, default) or accent. */
  paint?: "gradient" | "accent" | undefined;
  /** Bar height in px (default 3). */
  size?: number | undefined;
  class?: ClassProp | undefined;
}

/** `<ScrollProgress />` (page), `<ScrollProgress target={() => article} position="inline" />` */
export function ScrollProgress(props: ScrollProgressProps): Element {
  const pct = signal(0);
  const fill = h("span", { class: "hm-sprog-fill" }) as HTMLElement;
  const root = h("div", {
    class: cx("hm-sprog", `hm-sprog-${props.position ?? "fixed"}`, `hm-sprog-${props.paint ?? "gradient"}`, val(props.class)),
    role: "progressbar", "aria-label": t`Reading progress`, "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": () => String(pct()),
  }, fill) as HTMLElement;
  if (props.size) setStyle(root, { "--hm-sprog-h": `${props.size}px` });
  let el: Element | null = null;
  queueMicrotask(() => {
    el = props.target?.() ?? null;
    scrollScene(el, (s) => {
      // an article: 0 when its top reaches the top of the viewport, 1 when its end reaches the bottom
      const p = el ? s.pin : s.page;
      setStyle(fill, { transform: `scaleX(${p.toFixed(4)})` });
      const n = Math.round(p * 100);
      if (n !== pct.peek()) pct.set(n);
    });
  });
  return root;
}
