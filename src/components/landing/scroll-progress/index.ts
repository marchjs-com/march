// ScrollProgress (hadi-march/landing): a thin bar that fills as the page (or one article) is read. Fixed to the top or
// placed inline; brand gradient or the accent; a Progress line whose fill the motion core's scrollIndicator drives. RTL
// fills from the right. It is a progressbar for assistive technology, with the percentage as its value.
import "./scroll-progress.css";
import { h } from "../../../dom/h.ts";
import { signal, onCleanup, getOwner, runWithOwner } from "../../../core/reactive.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, type ClassProp } from "../../../ui/util.ts";
import { scrollIndicator, onScrollProgress, type ScrollSource } from "../../../motion/scroll-fx.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { Progress } from "../../feedback/progress/index.ts";

export interface ScrollProgressProps {
  /** Measure this element (an article) instead of the whole page. @tr Bütün sayfa yerine bu öğeyi (bir makale) ölçer. */
  target?: (() => Element | null) | undefined;
  /** fixed (top of the viewport, default) or inline. @tr fixed (görüntü alanının üstü, varsayılan) ya da inline. */
  position?: "fixed" | "inline" | undefined;
  /** gradient (brand colours, default) or accent. @tr gradient (marka renkleri, varsayılan) ya da accent. */
  paint?: "gradient" | "accent" | undefined;
  /** Bar height in px (default 3). @tr Çubuk yüksekliği, px (varsayılan 3). */
  size?: number | undefined;
  /** Colour of the fill (a theme token); wins over `paint`. @tr Dolgunun rengi (bir tema token'ı); `paint` değerinin önüne geçer. */
  color?: ColorToken | undefined;
  /** Accessible name (default "Reading progress"). @tr Erişilebilir ad (varsayılan "Reading progress"). */
  label?: string | undefined;
  /** Extra CSS class on the bar. @tr Çubuğa eklenen ek CSS sınıfı. */
  class?: ClassProp | undefined;
}

/** `<ScrollProgress />` (page), `<ScrollProgress target={() => article} position="inline" />` */
export function ScrollProgress(props: ScrollProgressProps): Element {
  const pct = signal(0);
  let fill!: HTMLElement;
  // the line is a Progress (variant "line") whose fill the scroll drives; the percentage feeds its ARIA value
  const root = h(Progress, {
    variant: "line", smooth: false, track: props.position === "inline", value: pct, ariaLabel: props.label ?? t`Reading progress`,
    color: props.color, ...(props.size ? { size: props.size } : {}), fillRef: (x: HTMLElement) => { fill = x; },
    class: cx("m-scroll-progress", `m-scroll-progress-${props.position ?? "fixed"}`, `m-scroll-progress-${props.paint ?? "gradient"}`, val(props.class)),
  }) as HTMLElement;
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
