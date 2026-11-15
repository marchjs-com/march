// Carousel (hadi-march/ui).
import "./carousel.css";
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { ownIcon } from "../../../ui/parts.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import type { IconDef } from "../../../icons/svg.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { PageDots } from "../../navigation/page-dots/index.ts";
import { chevronLeft } from "../../../icons/glyphs/chevronLeft.ts";
import { chevronRight } from "../../../icons/glyphs/chevronRight.ts";
import { withColor } from "../../../theme/colors.ts";

export interface CarouselProps {
  /** Accessible name of the carousel (default "Carousel", translated). @tr Atlıkarıncanın erişilebilir adı (varsayılan "Carousel", çevrilir). */
  label?: MaybeFn<string | undefined>;
  /** Slides per view on wide screens. @tr Geniş ekranlarda görünümdeki slayt sayısı (varsayılan 1). */
  perView?: 1 | 2 | 3 | 4;
  /** Extra class on the carousel. @tr Atlıkarıncaya eklenen sınıf. */
  class?: ClassProp;
  /** The slides. @tr Slaytlar. */
  children?: unknown;
  /** Accessible names of the buttons and dots (defaults are translated): `{ previous, next, slide: (n) => "Photo " + n }`. @tr Düğmelerin ve noktaların erişilebilir adları (varsayılanlar çevrilir): `{ previous, next, slide: (n) => "Photo " + n }`. */
  labels?: { previous?: string; next?: string; slide?: (n: number) => string } | undefined;
  /** The previous / next buttons (default true). @tr Önceki / sonraki düğmeleri (varsayılan true). */
  arrows?: boolean | undefined;
  /** Glyph or node of the previous button (default: a chevron). @tr Önceki düğmesinin glifi ya da düğümü (varsayılan: bir ok). */
  prevIcon?: unknown;
  /** Glyph or node of the next button (default: a chevron). @tr Sonraki düğmesinin glifi ya da düğümü (varsayılan: bir ok). */
  nextIcon?: unknown;
  /** The dots: true (default), false, or `(index, active) => content` drawn inside each dot button. @tr Noktalar: true (varsayılan), false ya da her nokta düğmesinin içine çizilen `(index, active) => content`. */
  dots?: boolean | ((index: number, active: () => boolean) => unknown) | undefined;
  /** Buttons and dots scroll smoothly (default true); false jumps. @tr Düğmeler ve noktalar yumuşak kaydırır (varsayılan true); false ile atlar. */
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
  const last = (): number => count() - (props.perView ?? 1);
  // previous / next: raised round IconButtons at the sides
  const arrow = (dir: "prev" | "next", own: unknown, def: IconDef, name: () => string, off: () => boolean, to: () => number): unknown =>
    h(IconButton, { variant: "raised", shape: "round", class: `m-carousel-btn m-carousel-${dir}`, label: name, title: false, disabled: off, onClick: () => goTo(to()), icon: ownIcon(own, def, "m-carousel-icon") });
  queueMicrotask(update);
  return h("section", { class: () => cx("m-carousel", `m-carousel-${props.perView ?? 1}`, props.smooth === false && "is-instant", val(props.class)), "aria-roledescription": "carousel", "aria-label": () => val(props.label) ?? t`Carousel` },
    h("div", { class: "m-carousel-track", ref: (el: HTMLElement) => { track = el; }, onScroll: update, tabindex: "0" }, props.children),
    props.arrows !== false && arrow("prev", props.prevIcon, chevronLeft, () => props.labels?.previous ?? t`Previous`, () => index() <= 0, () => index() - 1),
    props.arrows !== false && arrow("next", props.nextIcon, chevronRight, () => props.labels?.next ?? t`Next`, () => index() >= last(), () => index() + 1),
    props.dots !== false && h(PageDots, { class: "m-carousel-dots", count: () => Math.max(0, last() + 1), value: index, onChange: goTo,
      labels: { page: (n: number) => props.labels?.slide?.(n) ?? t`Slide ${n}` }, ...(ownDot ? { dot: ownDot } : {}) }));
}
