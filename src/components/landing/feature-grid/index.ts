// FeatureGrid (hadi-march/landing): what a product does, as a grid. Four looks:
//   cards  Cards with an IconTile, title and text; a soft light follows the pointer across the grid
//   plain  no boxes, icon and text only (dense marketing pages)
//   list   icon beside the text, two columns (a checklist of benefits)
//   bento  tiles of different sizes (wide, tall, big) with optional media: an asymmetric showcase grid
// Items enter one after another (Reveal). Every tile in a row has the same height; on phones everything stacks.
import "./feature-grid.css";
import { h } from "../../../dom/h.ts";
import { cx, val, listen, setStyle, type ClassProp } from "../../../ui/util.ts";
import { owned } from "../../../ui/observe.ts";
import { Grid } from "../../../ui/stack.ts";
import { Card } from "../../../ui/card.ts";
import { IconTile, type IconTone } from "../../../ui/app.ts";
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
  items: readonly FeatureItem[];
  variant?: "cards" | "plain" | "list" | "bento" | undefined;
  /** Columns (cards / plain: 2–4, default 3). */
  cols?: 2 | 3 | 4 | undefined;
  /** Pointer light on cards and bento tiles (default true). */
  spotlight?: boolean | undefined;
  /** Entrance (default "up"): a Reveal effect, your own `{ from, to }`, or "none" to switch it off. */
  reveal?: RevealOptions["effect"];
  class?: ClassProp | undefined;
}

const TONES: IconTone[] = ["primary", "info", "success", "violet", "warn", "pink", "teal"];

/** `<FeatureGrid items={[{ icon: zap, title: "Fast", body: "…" }]} variant="cards" cols={3} />` */
export function FeatureGrid(props: FeatureGridProps): Element {
  const variant = props.variant ?? "cards";
  const tile = (it: FeatureItem, i: number): Element => {
    const head = [
      it.icon != null && h(IconTile, { icon: it.icon, tone: it.tone ?? (variant === "plain" || variant === "list" ? "primary" : TONES[i % TONES.length]), size: variant === "list" ? "sm" : "md" }),
      h("div", { class: "hm-fg-text" },
        h("h3", { class: "hm-fg-title" }, it.href ? h("a", { href: it.href, class: "hm-fg-link" }, it.title) : it.title),
        it.body != null && h("p", { class: "hm-fg-body" }, it.body)),
    ];
    const media = variant === "bento" && it.media != null ? h("div", { class: "hm-fg-media" }, it.media) : null;
    const cls = cx("hm-fg-item", variant === "bento" && `hm-fg-span-${it.span ?? "normal"}`, it.href && "is-link");
    if (variant === "cards" || variant === "bento") return h(Card, { as: "article", class: cls }, head, media) as Element;
    return h("article", { class: cls }, head);
  };
  const grid = variant === "bento"
    ? h("div", { class: "hm-fg-bento" }, props.items.map(tile))
    : h(Grid, { cols: variant === "list" ? 2 : props.cols ?? 3, gap: variant === "plain" ? 6 : 4, equal: variant === "cards" }, props.items.map(tile));
  const root = h("div", { class: cx("hm-fg", `hm-fg-v-${variant}`, props.spotlight !== false && (variant === "cards" || variant === "bento") && "is-spotlight", val(props.class)) }, grid) as HTMLElement;

  if (props.reveal !== "none") owned(revealOnScroll(root, { effect: props.reveal ?? "up", select: ".hm-fg-item", stagger: 70 }));
  if (props.spotlight !== false && (variant === "cards" || variant === "bento")) {
    // one listener for the grid; every tile gets the pointer position relative to itself (its glow and border light)
    let pending = false, px = 0, py = 0;
    owned(listen(root, {
      pointermove: (e: PointerEvent) => {
        px = e.clientX; py = e.clientY;
        if (pending) return;
        pending = true;
        measure(() => {
          const tiles = [...root.querySelectorAll<HTMLElement>(".hm-fg-item")], rects = tiles.map((t) => t.getBoundingClientRect());
          mutate(() => { pending = false; tiles.forEach((t, i) => setStyle(t, { "--hm-fg-x": `${px - rects[i]!.left}px`, "--hm-fg-y": `${py - rects[i]!.top}px` })); });
        });
      },
    }));
  }
  return root;
}
