// FeatureGrid (hadi-march/landing): what a product does, as a grid. Four looks:
//   cards  Cards with an IconTile, title and text; a soft light follows the pointer across the grid
//   plain  no boxes, icon and text only (dense marketing pages)
//   list   icon beside the text, two columns (a checklist of benefits)
//   bento  tiles of different sizes (wide, tall, big) with optional media: an asymmetric showcase grid
// Items enter one after another (Reveal). Every tile in a row has the same height; on phones everything stacks.
// A tile is a ListRow (icon in the lead, the title as an h3, the text as a paragraph), in a Card for cards and bento.
import "./feature-grid.css";
import { h } from "../../../dom/h.ts";
import { cx, val, listen, setStyle, type ClassProp } from "../../../ui/util.ts";
import { owned } from "../../../ui/observe.ts";
import { Grid } from "../../../ui/stack.ts";
import { Card } from "../../../ui/card.ts";
import { IconTile, type IconTone } from "../../../ui/app.ts";
import { ListRow } from "../../data/list-row/index.ts";
import { measure, mutate } from "../../../motion/engine/clock.ts";
import { revealOnScroll, type RevealOptions } from "../reveal/index.ts";

export interface FeatureItem {
  icon?: unknown | undefined;
  title: unknown;
  body?: unknown | undefined;
  /** Makes the whole tile a link. */
  href?: string | undefined;
  tone?: IconTone | undefined;
  /** bento: tile size. */
  span?: "normal" | "wide" | "tall" | "big" | undefined;
  /** bento: a picture, chart or UI fragment at the bottom of the tile. */
  media?: unknown | undefined;
}
export interface FeatureGridProps {
  /** The features: `{ icon?, title, body?, href?, tone?, span?, media? }`. @tr Özellikler: `{ icon?, title, body?, href?, tone?, span?, media? }`. */
  items: readonly FeatureItem[];
  /** Look: cards (default), plain, list or bento. @tr Görünüm: cards (varsayılan), plain, list ya da bento. */
  variant?: "cards" | "plain" | "list" | "bento" | undefined;
  /** Columns (cards / plain: 2–4, default 3). @tr Sütun sayısı (cards / plain: 2–4, varsayılan 3). */
  cols?: 2 | 3 | 4 | undefined;
  /** Pointer light on cards and bento tiles (default true). @tr Kartlarda ve bento karolarında işaretçi ışığı (varsayılan true). */
  spotlight?: boolean | undefined;
  /** Entrance (default "up"): a Reveal effect, your own `{ from, to }`, or "none" to switch it off. @tr Giriş (varsayılan "up"): bir Reveal efekti, kendi `{ from, to }` değeriniz ya da kapatmak için "none". */
  reveal?: RevealOptions["effect"];
  /** Extra CSS class on the root (`.m-fg`). @tr Köke (`.m-fg`) eklenen ek CSS sınıfı. */
  class?: ClassProp | undefined;
}

const TONES: IconTone[] = ["primary", "info", "success", "violet", "warn", "pink", "teal"];

/** `<FeatureGrid items={[{ icon: zap, title: "Fast", body: "…" }]} variant="cards" cols={3} />` */
export function FeatureGrid(props: FeatureGridProps): Element {
  const variant = props.variant ?? "cards";
  const tile = (it: FeatureItem, i: number): Element => {
    const row = (as: "article" | "div", cls: string): Element => h(ListRow, {
      as, class: cls, direction: variant === "list" ? "row" : "column", align: "start", overflow: "wrap", titleAs: "h3", subAs: "p",
      lead: it.icon != null ? h(IconTile, { icon: it.icon, tone: it.tone ?? (variant === "plain" || variant === "list" ? "primary" : TONES[i % TONES.length]), size: variant === "list" ? "sm" : "md" }) : undefined,
      title: it.href ? h("a", { href: it.href, class: "m-fg-link" }, it.title) : it.title, sub: it.body ?? undefined,
    }) as Element;
    const media = variant === "bento" && it.media != null ? h("div", { class: "m-fg-media" }, it.media) : null;
    const cls = cx("m-fg-item", variant === "bento" && `m-fg-span-${it.span ?? "normal"}`, it.href && "is-link");
    if (variant === "cards" || variant === "bento") return h(Card, { as: "article", class: cls }, row("div", "m-fg-row"), media) as Element;
    return row("article", cx("m-fg-row", cls));
  };
  const grid = variant === "bento"
    ? h("div", { class: "m-fg-bento" }, props.items.map(tile))
    : h(Grid, { cols: variant === "list" ? 2 : props.cols ?? 3, gap: variant === "plain" ? 6 : 4, equal: variant === "cards" }, props.items.map(tile));
  const root = h("div", { class: cx("m-fg", `m-fg-v-${variant}`, props.spotlight !== false && (variant === "cards" || variant === "bento") && "is-spotlight", val(props.class)) }, grid) as HTMLElement;

  if (props.reveal !== "none") owned(revealOnScroll(root, { effect: props.reveal ?? "up", select: ".m-fg-item", stagger: 70 }));
  if (props.spotlight !== false && (variant === "cards" || variant === "bento")) {
    // one listener for the grid; every tile gets the pointer position relative to itself (its glow and border light)
    let pending = false, px = 0, py = 0;
    owned(listen(root, {
      pointermove: (e: PointerEvent) => {
        px = e.clientX; py = e.clientY;
        if (pending) return;
        pending = true;
        measure(() => {
          const tiles = [...root.querySelectorAll<HTMLElement>(".m-fg-item")], rects = tiles.map((t) => t.getBoundingClientRect());
          mutate(() => { pending = false; tiles.forEach((t, i) => setStyle(t, { "--m-fg-x": `${px - rects[i]!.left}px`, "--m-fg-y": `${py - rects[i]!.top}px` })); });
        });
      },
    }));
  }
  return root;
}
