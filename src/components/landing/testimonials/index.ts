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
import { revealOnScroll } from "../reveal/index.ts";

export interface Testimonial { quote: unknown; name: string; role?: unknown; avatar?: string | undefined; rating?: number | undefined }
export interface TestimonialsProps {
  items: readonly Testimonial[];
  variant?: "grid" | "marquee" | "wall" | "slider" | undefined;
  /** Grid / slider columns (default 3). */
  cols?: 1 | 2 | 3 | undefined;
  class?: ClassProp | undefined;
}

function quoteCard(it: Testimonial, hidden = false): Element {
  return h(Card, { as: "figure", class: "hm-tm-card", "aria-hidden": hidden ? "true" : null },
    it.rating != null ? h(Rating, { value: it.rating, readonly: true, size: "sm", class: "hm-tm-rating", label: t`${it.rating} out of 5` }) : null,
    h("blockquote", { class: "hm-tm-quote" }, h("p", {}, it.quote)),
    h("figcaption", { class: "hm-tm-who" },
      h(Avatar, { name: it.name, src: it.avatar, size: "md" }),
      h("span", { class: "hm-tm-id" }, h("cite", { class: "hm-tm-name" }, it.name), it.role != null ? h("span", { class: "hm-tm-role" }, it.role) : null))) as Element;
}

/** `<Testimonials variant="wall" items={[{ quote: "…", name: "Ada", role: "CTO, HADİ", rating: 5 }]} />` */
export function Testimonials(props: TestimonialsProps): Element {
  const variant = props.variant ?? "grid";
  const cls = cx("hm-tm", `hm-tm-${variant}`, val(props.class));
  if (variant === "marquee") {
    const half = Math.ceil(props.items.length / 2);
    const row = (list: readonly Testimonial[], speed: number): unknown => h(Marquee, { speed, pause: 0, separator: "", class: "hm-tm-row" },
      h("span", { class: "hm-tm-strip" }, list.map((x) => quoteCard(x)), h("span", { class: "hm-tm-strip", "aria-hidden": "true", inert: "" }, list.map((x) => quoteCard(x, true)))));
    return h("div", { class: cls }, row(props.items.slice(0, half), 28), row(props.items.slice(half), 20)) as Element;
  }
  if (variant === "slider") return h("div", { class: cls }, h(Carousel, { perView: props.cols ?? 1, label: t`Testimonials` }, props.items.map((x) => h("div", { class: "hm-tm-slide" }, quoteCard(x))))) as Element;
  const open = signal(false);
  const list = h("div", { class: () => cx("hm-tm-list", variant === "grid" && `hm-tm-cols-${props.cols ?? 3}`, variant === "wall" && !open() && "is-closed") }, props.items.map((x) => quoteCard(x))) as HTMLElement;
  const root = h("div", { class: cls }, list,
    variant === "wall" && props.items.length > 6 ? h("div", { class: () => cx("hm-tm-more", open() && "is-open") }, h(Button, { variant: "secondary", onClick: () => open.set(!open()), "aria-expanded": () => String(open()) }, () => (open() ? t`Show less` : t`Show more`))) : null) as Element;
  const stop = revealOnScroll(list, { effect: "up", select: ".hm-tm-card", stagger: 60 });
  if (getOwner()) onCleanup(stop);
  return root;
}
