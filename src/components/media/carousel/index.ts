// Carousel (hadi-march/ui).
import "./carousel.css";
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, glyph, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { chevronLeft } from "../../../icons/glyphs/chevronLeft.ts";
import { chevronRight } from "../../../icons/glyphs/chevronRight.ts";

export interface CarouselProps {
  label?: MaybeFn<string | undefined>; /** Slides per view on wide screens. */ perView?: 1 | 2 | 3 | 4; class?: ClassProp; children?: unknown;
  /** Accessible names of the buttons and dots (defaults are translated): `{ previous, next, slide: (n) => "Photo " + n }`. */
  labels?: { previous?: string; next?: string; slide?: (n: number) => string } | undefined;
  /** The previous / next buttons (default true). */
  arrows?: boolean | undefined;
  /** Glyph or node of the previous button (default: a chevron). */
  prevIcon?: unknown;
  /** Glyph or node of the next button (default: a chevron). */
  nextIcon?: unknown;
  /** The dots: true (default), false, or `(index, active) => content` drawn inside each dot button. */
  dots?: boolean | ((index: number, active: () => boolean) => unknown) | undefined;
  /** Theme color of the active dot (default: primary). */
  color?: ColorToken | undefined;
  /** Buttons and dots scroll smoothly (default true); false jumps. */
  smooth?: boolean | undefined;
}
/** Scroll-snap carousel with buttons and dots (swipe on touch): `<Carousel perView={3}>{slides}</Carousel>` */
export function Carousel(props: CarouselProps): Element {
  let track: HTMLElement | undefined;
  const index = signal(0), count = signal(0);
  const update = (): void => {
    if (!track) return;
    const slides = [...track.children] as HTMLElement[];
    count.set(slides.length);
    const left = Math.abs(track.scrollLeft || 0), w = slides[0]?.offsetWidth || 1;
    index.set(Math.round(left / (w + 16)));
  };
  const goTo = (i: number): void => { const s = track?.children[i] as HTMLElement | undefined; if (s && track) track.scrollTo({ left: s.offsetLeft - track.offsetLeft, behavior: props.smooth === false ? "auto" : "smooth" }); };
  const ownDot = typeof props.dots === "function" ? props.dots : null;
  const arrow = (own: unknown, def: typeof chevronLeft): unknown => (own === undefined ? glyph(def) : icon(own, "hm-carousel-icon"));
  queueMicrotask(update);
  return h("section", { class: () => cx("hm-carousel", `hm-carousel-${props.perView ?? 1}`, props.smooth === false && "is-instant", val(props.class)), "aria-roledescription": "carousel", "aria-label": () => val(props.label) ?? t`Carousel` },
    h("div", { class: "hm-carousel-track", ref: (el: HTMLElement) => { track = el; }, onScroll: update, tabindex: "0" }, props.children),
    props.arrows !== false && h("button", { type: "button", class: "hm-carousel-btn hm-carousel-prev", "aria-label": () => props.labels?.previous ?? t`Previous`, disabled: () => index() <= 0, onClick: () => goTo(index() - 1) }, arrow(props.prevIcon, chevronLeft)),
    props.arrows !== false && h("button", { type: "button", class: "hm-carousel-btn hm-carousel-next", "aria-label": () => props.labels?.next ?? t`Next`, disabled: () => index() >= count() - (props.perView ?? 1), onClick: () => goTo(index() + 1) }, arrow(props.nextIcon, chevronRight)),
    props.dots !== false && h("div", { class: "hm-carousel-dots", "data-hm-color": colorAttr(props.color) }, () => Array.from({ length: Math.max(0, count() - (props.perView ?? 1) + 1) }, (_, i) =>
      h("button", { type: "button", class: () => cx("hm-carousel-dot", ownDot && "is-own", index() === i && "is-active"), "aria-label": () => props.labels?.slide?.(i + 1) ?? t`Slide ${i + 1}`, onClick: () => goTo(i) },
        ownDot ? ownDot(i, () => index() === i) : null))));
}
