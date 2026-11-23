// Carousel (march/ui).
import "./carousel.css";
import { signal } from "../../../core/reactive.ts";
import { owned } from "../../../ui/observe.ts";
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
import type { IconProp } from "../../../icons/types.ts";
import { on } from "../../../core/util.ts";

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
  prevIcon?: IconProp;
  /** Glyph or node of the next button (default: a chevron). @tr Sonraki düğmesinin glifi ya da düğümü (varsayılan: bir ok). */
  nextIcon?: IconProp;
  /** The dots: true (default), false, or `(index, active) => content` drawn inside each dot button. @tr Noktalar: true (varsayılan), false ya da her nokta düğmesinin içine çizilen `(index, active) => content`. */
  dots?: boolean | ((index: number, active: () => boolean) => unknown) | undefined;
  /** Buttons and dots scroll smoothly (default true); false jumps. @tr Düğmeler ve noktalar yumuşak kaydırır (varsayılan true); false ile atlar. */
  smooth?: boolean | undefined;
  /** Swiping between slides: "touch" (default: a finger swipes, as the page scrolls), true (the mouse drags too) or false (only the buttons, dots and keys). @tr Slaytlar arasında kaydırma: "touch" (varsayılan: parmakla, sayfa kayar gibi), true (fare de sürükler) ya da false (yalnız düğmeler, noktalar ve tuşlar). */
  swipe?: boolean | "touch" | undefined;
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
  // measured from the first slide, so right-to-left (negative scrollLeft) lands on the slide too
  const goTo = (i: number): void => { const s = track?.children[i] as HTMLElement | undefined, s0 = track?.children[0] as HTMLElement | undefined; if (s && s0 && track) track.scrollTo({ left: s.offsetLeft - s0.offsetLeft, behavior: props.smooth === false ? "auto" : "smooth" }); };
  const ownDot = typeof props.dots === "function" ? props.dots : null;
  const last = (): number => count() - (props.perView ?? 1);
  // previous / next: raised round IconButtons at the sides
  const arrow = (dir: "prev" | "next", own: unknown, def: IconDef, name: () => string, off: () => boolean, to: () => number): unknown =>
    h(IconButton, { variant: "raised", shape: "round", class: `m-carousel-btn m-carousel-${dir}`, label: name, title: false, disabled: off, onClick: () => goTo(to()), icon: ownIcon(own, def, "m-carousel-icon") });
  queueMicrotask(update);
  // swipe={true}: the mouse drags the track as a finger does; let go, it settles on the next slide (a short flick is
  // enough) or back on this one. A drag is no click: the click that ends it does not reach the slide
  let drag: { x: number; left: number; moved: boolean; at: number } | null = null, dragged = false;
  const offs: Array<() => void> = []; // a drag's window listeners, while it lasts
  const noClick = (c: Event): void => { if (dragged) { c.stopPropagation(); c.preventDefault(); } };
  // swipe={false}: the track does not scroll by itself, so ← → move it here
  const onKeyDown = (e: KeyboardEvent): void => {
    if (props.swipe !== false || (e.key !== "ArrowLeft" && e.key !== "ArrowRight") || !track) return;
    e.preventDefault();
    const fwd = (e.key === "ArrowRight") !== (getComputedStyle(track).direction === "rtl");
    goTo(Math.max(0, Math.min(last(), index.peek() + (fwd ? 1 : -1))));
  };
  const nearest = (): number => { update(); return index.peek(); };
  const onPointerDown = (e: PointerEvent): void => {
    if (props.swipe !== true || e.pointerType !== "mouse" || e.button !== 0 || !track) return;
    drag = { x: e.clientX, left: track.scrollLeft, moved: false, at: index.peek() };
    const move = (ev: PointerEvent): void => {
      if (!drag || !track) return;
      const dx = ev.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < 5) return;
      if (!drag.moved) { drag.moved = true; track.classList.add("is-dragging"); }
      track.scrollLeft = drag.left - dx;
    };
    const up = (ev: PointerEvent): void => {
      for (const f of offs.splice(0)) f();
      const d = drag;
      drag = null;
      if (!d || !track) return;
      track.classList.remove("is-dragging");
      if (!d.moved) return;
      // which way the content went: dragging toward the start shows the next slide (mirrored right to left)
      const dx = (ev.clientX - d.x) * (getComputedStyle(track).direction === "rtl" ? -1 : 1);
      const to = Math.abs(dx) > 40 ? d.at + (dx < 0 ? 1 : -1) : nearest();
      goTo(Math.max(0, Math.min(last(), to)));
      dragged = true;
      setTimeout(() => { dragged = false; }, 0);
    };
    offs.push(on(globalThis, "pointermove", move), on(globalThis, "pointerup", up));
  };
  // slides added or removed later: the count (arrows, dots) follows
  const watch = (el: HTMLElement): void => {
    const MO = globalThis.MutationObserver;
    if (!MO) return;
    const mo = new MO(update);
    mo.observe(el, { childList: true });
    owned(() => mo.disconnect());
  };
  // a text or number slide (children={["Bir", "İki"]}) gets a plain slide box of its own
  const slide = (x: unknown): unknown => (typeof x === "string" || typeof x === "number" ? h("div", { class: "m-carousel-text" }, String(x)) : x);
  // (JSX may hand them in nested, <Carousel>{list}</Carousel> is [[…]], or as a getter)
  const slidesOf = (c: unknown): unknown => (typeof c === "function" ? () => slidesOf((c as () => unknown)()) : Array.isArray(c) ? c.flat(Infinity).map(slide) : slide(c));
  const slides = slidesOf(props.children);
  return h("section", { class: () => cx("m-carousel", `m-carousel-${props.perView ?? 1}`, props.smooth === false && "is-instant", props.swipe === true && "is-swipe", props.swipe === false && "is-noswipe", val(props.class)), "aria-roledescription": "carousel", "aria-label": () => val(props.label) ?? t`Carousel` },
    h("div", { class: "m-carousel-track", ref: (el: HTMLElement) => { track = el; watch(el); el.addEventListener("click", noClick, true); }, onScroll: update, onPointerDown: onPointerDown, onKeyDown: onKeyDown, onDragStart: (e: DragEvent) => { if (props.swipe === true) e.preventDefault(); }, tabindex: "0" }, slides),
    props.arrows !== false && arrow("prev", props.prevIcon, chevronLeft, () => props.labels?.previous ?? t`Previous`, () => index() <= 0, () => index() - 1),
    props.arrows !== false && arrow("next", props.nextIcon, chevronRight, () => props.labels?.next ?? t`Next`, () => index() >= last(), () => index() + 1),
    props.dots !== false && h(PageDots, { class: "m-carousel-dots", count: () => Math.max(0, last() + 1), value: index, onChange: goTo,
      labels: { page: (n: number) => props.labels?.slide?.(n) ?? t`Slide ${n}` }, ...(ownDot ? { dot: ownDot } : {}) }));
}
