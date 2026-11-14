// Testimonials (hadi-march/landing): what customers say, in four layouts:
//   grid     quote cards in equal rows
//   marquee  two endless rows of cards drifting at different speeds (Marquee; still with reduced motion)
//   wall     a masonry wall that fades out at the bottom, with a "Show more" button that opens it up
//   slider   one card at a time (Carousel: swipe, buttons, dots)
// Every card: quote, optional star Rating, Avatar, name and role.
import "./testimonials.css";
import { h } from "../../../dom/h.ts";
import { signal, onCleanup, getOwner } from "../../../core/reactive.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, type ClassProp } from "../../../ui/util.ts";
import { Card } from "../../../ui/card.ts";
import { Avatar } from "../../../ui/avatar.ts";
import { Rating } from "../../../ui/rating.ts";
import { Marquee } from "../../../ui/marquee.ts";
import { Carousel } from "../../../ui/carousel.ts";
import { Button } from "../../../ui/button.ts";
// Reveal: entries enter one after another
import { revealOnScroll, type RevealOptions } from "../reveal/index.ts";
import type { ColorToken } from "../../../theme/colors.ts";

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

function quoteCard(it: Testimonial, props: TestimonialsProps, hidden = false): Element {
  return h(Card, { as: "figure", class: "hm-tm-card", "aria-hidden": hidden ? "true" : null },
    it.rating != null && props.rating !== false ? h(Rating, { value: it.rating, readonly: true, size: "sm", class: "hm-tm-rating", color: props.ratingColor, label: props.labels?.rating ? props.labels.rating(it.rating) : t`${it.rating} out of 5` }) : null,
    h("blockquote", { class: "hm-tm-quote" }, h("p", {}, it.quote)),
    h("figcaption", { class: "hm-tm-who" },
      props.avatar !== false ? h(Avatar, { name: it.name, src: it.avatar, size: "md" }) : null,
      h("span", { class: "hm-tm-id" }, h("cite", { class: "hm-tm-name" }, it.name), it.role != null ? h("span", { class: "hm-tm-role" }, it.role) : null))) as Element;
}

/** `<Testimonials variant="wall" items={[{ quote: "…", name: "Ada", role: "CTO, HADİ", rating: 5 }]} />` */
export function Testimonials(props: TestimonialsProps): Element {
  const variant = props.variant ?? "grid";
  const cls = cx("hm-tm", `hm-tm-${variant}`, props.quotes === false && "hm-tm-plain", val(props.class));
  const L = props.labels ?? {};
  if (variant === "marquee") {
    const half = Math.ceil(props.items.length / 2);
    const row = (list: readonly Testimonial[], speed: number): unknown => h(Marquee, { speed, pause: 0, separator: "", class: "hm-tm-row" },
      h("span", { class: "hm-tm-strip" }, list.map((x) => quoteCard(x, props)), h("span", { class: "hm-tm-strip", "aria-hidden": "true", inert: "" }, list.map((x) => quoteCard(x, props, true)))));
    return h("div", { class: cls }, row(props.items.slice(0, half), props.speed?.[0] ?? 28), row(props.items.slice(half), props.speed?.[1] ?? 20)) as Element;
  }
  if (variant === "slider") return h("div", { class: cls }, h(Carousel, { perView: props.cols ?? 1, label: L.slider ?? t`Testimonials` }, props.items.map((x) => h("div", { class: "hm-tm-slide" }, quoteCard(x, props))))) as Element;
  const open = signal(props.more === false);
  const list = h("div", { class: () => cx("hm-tm-list", variant === "grid" && `hm-tm-cols-${props.cols ?? 3}`, variant === "wall" && !open() && "is-closed") }, props.items.map((x) => quoteCard(x, props))) as HTMLElement;
  const root = h("div", { class: cls }, list,
    variant === "wall" && props.more !== false && props.items.length > 6 ? h("div", { class: () => cx("hm-tm-more", open() && "is-open") }, h(Button, { variant: "secondary", onClick: () => open.set(!open()), "aria-expanded": () => String(open()) }, () => (open() ? L.less ?? t`Show less` : L.more ?? t`Show more`))) : null) as Element;
  if (props.reveal !== false) {
    const stop = revealOnScroll(list, { effect: "up", stagger: 60, ...props.reveal, select: ".hm-tm-card" });
    if (getOwner()) onCleanup(stop);
  }
  return root;
}
