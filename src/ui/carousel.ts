// Carousel (hadi-march/ui).
import "./carousel.css";
import { signal } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { val, cx, glyph, type MaybeFn, type ClassProp } from "./util.ts";
import { chevronLeft } from "../icons/glyphs/chevronLeft.ts";
import { chevronRight } from "../icons/glyphs/chevronRight.ts";

export interface CarouselProps { label?: MaybeFn<string | undefined>; /** Slides per view on wide screens. */ perView?: 1 | 2 | 3 | 4; class?: ClassProp; children?: unknown }
/** Scroll-snap carousel with buttons and dots (swipe on touch): `<Carousel perView={3}>{slides}</Carousel>` */
export function Carousel(props: CarouselProps): Element {
  let track: HTMLElement | undefined;
  const index = signal(0), count = signal(0);
  const update = (): void => {
    if (!track) return;
    const slides = [...track.children] as HTMLElement[];
    count.set(slides.length);
    const left = track.scrollLeft, w = slides[0]?.offsetWidth || 1;
    index.set(Math.round(left / (w + 16)));
  };
  const goTo = (i: number): void => { const s = track?.children[i] as HTMLElement | undefined; if (s && track) track.scrollTo({ left: s.offsetLeft - track.offsetLeft, behavior: "smooth" }); };
  queueMicrotask(update);
  return h("section", { class: () => cx("hm-carousel", `hm-carousel-${props.perView ?? 1}`, val(props.class)), "aria-roledescription": "carousel", "aria-label": () => val(props.label) ?? t`Carousel` },
    h("div", { class: "hm-carousel-track", ref: (el: HTMLElement) => { track = el; }, onScroll: update, tabindex: "0" }, props.children),
    h("button", { type: "button", class: "hm-carousel-btn hm-carousel-prev", "aria-label": () => t`Previous`, disabled: () => index() <= 0, onClick: () => goTo(index() - 1) }, glyph(chevronLeft)),
    h("button", { type: "button", class: "hm-carousel-btn hm-carousel-next", "aria-label": () => t`Next`, disabled: () => index() >= count() - (props.perView ?? 1), onClick: () => goTo(index() + 1) }, glyph(chevronRight)),
    h("div", { class: "hm-carousel-dots" }, () => Array.from({ length: Math.max(0, count() - (props.perView ?? 1) + 1) }, (_, i) =>
      h("button", { type: "button", class: () => cx("hm-carousel-dot", index() === i && "is-active"), "aria-label": () => t`Slide ${i + 1}`, onClick: () => goTo(i) }))));
}
