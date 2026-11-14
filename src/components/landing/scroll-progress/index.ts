// ScrollProgress (hadi-march/landing): a thin bar that fills as the page (or one article) is read. Fixed to the top or
// placed inline; brand gradient or the accent; drawn by the motion core's scrollIndicator. RTL fills
// from the right. It is a progressbar for assistive technology, with the percentage as its value.
import "./scroll-progress.css";
import { h } from "../../../dom/h.ts";
import { signal } from "../../../core/reactive.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, setStyle, type ClassProp } from "../../../ui/util.ts";
import { scrollIndicator, onScrollProgress, type ScrollSource } from "../../../motion/scroll-fx.ts";
import { onCleanup, getOwner, runWithOwner } from "../../../core/reactive.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

export interface ScrollProgressProps {
  /** Measure this element (an article) instead of the whole page. */
  target?: (() => Element | null) | undefined;
  /** fixed (top of the viewport, default) or inline. */
  position?: "fixed" | "inline" | undefined;
  /** gradient (brand colours, default) or accent. */
  paint?: "gradient" | "accent" | undefined;
  /** Bar height in px (default 3). */
  size?: number | undefined;
  /** Colour of the fill (a theme token); wins over `paint`. */
  color?: ColorToken | undefined;
  /** Accessible name (default "Reading progress"). */
  label?: string | undefined;
  class?: ClassProp | undefined;
}

/** `<ScrollProgress />` (page), `<ScrollProgress target={() => article} position="inline" />` */
export function ScrollProgress(props: ScrollProgressProps): Element {
  const pct = signal(0);
  const fill = h("span", { class: "hm-sprog-fill" }) as HTMLElement;
  const root = h("div", {
    class: cx("hm-sprog", `hm-sprog-${props.position ?? "fixed"}`, `hm-sprog-${props.paint ?? "gradient"}`, val(props.class)),
    "data-hm-color": colorAttr(props.color),
    role: "progressbar", "aria-label": props.label ?? t`Reading progress`, "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": () => String(pct()),
  }, fill) as HTMLElement;
  if (props.size) setStyle(root, { "--hm-sprog-h": `${props.size}px` });
  let el: Element | null = null;
  const owner = getOwner();
  queueMicrotask(() => {
    el = props.target?.() ?? null;
    // the motion core's scrollIndicator draws the bar; the percentage follows for assistive technology
    const src: ScrollSource = el ? { track: el, range: [0.12, 0.88] } : {};
    const offs = [scrollIndicator(fill, src), onScrollProgress(src, (p) => { const n = Math.round(p * 100); if (n !== pct.peek()) pct.set(n); })];
    if (owner) runWithOwner(owner, () => onCleanup(() => offs.forEach((f) => f())));
  });
  return root;
}
