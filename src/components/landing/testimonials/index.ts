// Testimonials (hadi-march/landing): what customers say, in four layouts:
//   grid     quote cards in equal rows
//   marquee  two endless rows of cards drifting at different speeds (Marquee; still with reduced motion)
//   wall     a masonry wall that fades out at the bottom, with a "Show more" button that opens it up
//   slider   one card at a time (Carousel: swipe, buttons, dots)
// Every card: quote, optional star Rating, Avatar, name and role.
import "./testimonials.css";
import { h } from "../../../dom/h.ts";
import { signal } from "../../../core/reactive.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, type ClassProp } from "../../../ui/util.ts";
import { owned } from "../../../ui/observe.ts";
import { ListRow } from "../../data/list-row/index.ts";
import { Card } from "../../../ui/card.ts";
import { Avatar } from "../../../ui/avatar.ts";
import { Rating } from "../../../ui/rating.ts";
import { Marquee } from "../../../ui/marquee.ts";
import { Carousel } from "../../../ui/carousel.ts";
import { Button } from "../../../ui/button.ts";
// Reveal: entries enter one after another
import { revealOnScroll, type RevealOptions } from "../reveal/index.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { withColor } from "../../../theme/colors.ts";

export interface Testimonial { quote: unknown; name: string; role?: unknown; avatar?: string | undefined; rating?: number | undefined }
export interface TestimonialsProps {
  items: readonly Testimonial[];
  variant?: "grid" | "marquee" | "wall" | "slider" | undefined;
  /** Grid / slider columns (default 3). */
  cols?: 1 | 2 | 3 | undefined;
  /** The star rating of a card (default true). */
  rating?: boolean | undefined;
  /** Colour of the stars (default: the accent). */
  ratingColor?: ColorToken | undefined;
  /** The avatar next to the name (default true). */
  avatar?: boolean | undefined;
  /** The quotation marks around the quote (default true). */
  quotes?: boolean | undefined;
  /** wall: the "Show more" button (default true); false shows the whole wall. */
  more?: boolean | undefined;
  /** marquee: speed of the two rows, px per second (default [28, 20]). */
  speed?: [number, number] | undefined;
  /** Entrance of the cards (grid, wall): Reveal options, or false for none. */
  reveal?: RevealOptions | false | undefined;
  /** Own texts; every one defaults to the built-in translated text. */
  labels?: {
    more?: unknown; less?: unknown;
    /** Accessible name of the slider. */
    slider?: string | undefined;
    /** Accessible name of a rating. */
    rating?: ((value: number) => string) | undefined;
  } | undefined;
  class?: ClassProp | undefined;
}

function quoteCard(it: Testimonial, props: TestimonialsProps): Element {
  return h(Card, { as: "figure", class: "m-tm-card" },
    it.rating != null && props.rating !== false ? withColor(h(Rating, { value: it.rating, readonly: true, size: "sm", class: "m-tm-rating", label: props.labels?.rating ? props.labels.rating(it.rating) : t`${it.rating} out of 5` }), props.ratingColor) : null,
    h("blockquote", { class: "m-tm-quote" }, h("p", {}, it.quote)),
    // who said it: a ListRow (avatar, name, role)
    h("figcaption", { class: "m-tm-who" }, h(ListRow, {
      overflow: "ellipsis", lead: props.avatar !== false ? h(Avatar, { name: it.name, src: it.avatar, size: "md" }) : undefined,
      title: h("cite", { class: "m-tm-name" }, it.name), sub: it.role ?? undefined,
    }))) as Element;
}

/** `<Testimonials variant="wall" items={[{ quote: "…", name: "Ada", role: "CTO, HADİ", rating: 5 }]} />` */
export function Testimonials(props: TestimonialsProps): Element {
  const variant = props.variant ?? "grid";
  const cls = cx("m-tm", `m-tm-${variant}`, props.quotes === false && "m-tm-plain", val(props.class));
  const L = props.labels ?? {};
  if (variant === "marquee") {
    const half = Math.ceil(props.items.length / 2);
    // Marquee repeats the strip until it is wider than the screen (the copies are hidden from screen readers)
    const row = (list: readonly Testimonial[], speed: number): unknown => h(Marquee, { speed, pause: 0, separator: false, duplicate: true, class: "m-tm-row" },
      h("span", { class: "m-tm-strip" }, list.map((x) => quoteCard(x, props))));
    return h("div", { class: cls }, row(props.items.slice(0, half), props.speed?.[0] ?? 28), row(props.items.slice(half), props.speed?.[1] ?? 20)) as Element;
  }
  if (variant === "slider") return h("div", { class: cls }, h(Carousel, { perView: props.cols ?? 1, label: L.slider ?? t`Testimonials` }, props.items.map((x) => h("div", { class: "m-tm-slide" }, quoteCard(x, props))))) as Element;
  const open = signal(props.more === false);
  const list = h("div", { class: () => cx("m-tm-list", variant === "grid" && `m-tm-cols-${props.cols ?? 3}`, variant === "wall" && !open() && "is-closed") }, props.items.map((x) => quoteCard(x, props))) as HTMLElement;
  const root = h("div", { class: cls }, list,
    variant === "wall" && props.more !== false && props.items.length > 6 ? h("div", { class: () => cx("m-tm-more", open() && "is-open") }, h(Button, { variant: "secondary", onClick: () => open.set(!open()), "aria-expanded": () => String(open()) }, () => (open() ? L.less ?? t`Show less` : L.more ?? t`Show more`))) : null) as Element;
  if (props.reveal !== false) owned(revealOnScroll(list, { effect: "up", stagger: 60, ...props.reveal, select: ".m-tm-card" }));
  return root;
}
