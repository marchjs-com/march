// LogoCloud (march/landing): "trusted by" logos. `grid` lines them up (equal cells, they light up on hover);
// `marquee` runs them as an endless ticker (Marquee: fades at the edges, stops off screen, reduced motion keeps it
// still, screen readers read each name once). Logos are muted to one tone by default so no brand shouts.
import "./logo-cloud.css";
import { h } from "../../../dom/h.ts";
import { cx, val, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { owned } from "../../../ui/observe.ts";
import { Picture } from "../../media/picture/index.ts";
import { Marquee } from "../../../ui/marquee.ts";
import { Grid } from "../../../ui/stack.ts";
import { revealOnScroll, type RevealOptions } from "../reveal/index.ts"; // Reveal: the grid cells fade in one after another

export interface Logo {
  /** Accessible name (company). */
  name: string;
  /** Image URL (SVG or PNG); give width / height to reserve the space. */
  src?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  /** Or any node (an inline SVG). Without `src` and `node` the name is shown as a text wordmark. */
  node?: unknown | undefined;
  href?: string | undefined;
}
export interface LogoCloudProps {
  /** The logos: `{ src, alt, width?, height?, href? }` or `{ node }`. @tr Logolar: `{ src, alt, width?, height?, href? }` ya da `{ node }`. */
  logos: readonly Logo[];
  /** grid (default): a row of cells · marquee: an endless scrolling strip. @tr grid (varsayılan): hücrelerden bir sıra · marquee: sonsuz kayan bir şerit. */
  variant?: "grid" | "marquee" | undefined;
  /** Small heading above ("Trusted by teams at"). @tr Üstteki küçük başlık ("Trusted by teams at"). */
  title?: MaybeFn<unknown> | undefined;
  /** One muted tone, full colour on hover (default true). @tr Tek soluk ton, üzerine gelince tam renk (varsayılan true). */
  mono?: boolean | undefined;
  /** Marquee speed, px/s (default 40). @tr Marquee hızı, px/s (varsayılan 40). */
  speed?: number | undefined;
  /** grid: entrance of the cells (default "fade"): a Reveal effect, your own `{ from, to }`, or "none". @tr grid: hücrelerin girişi (varsayılan "fade"): bir Reveal efekti, kendi `{ from, to }` değeriniz ya da "none". */
  reveal?: RevealOptions["effect"];
  /** Extra CSS class on the root. @tr Köke eklenen ek CSS sınıfı. */
  class?: ClassProp | undefined;
}

function logoNode(l: Logo): Element {
  // neither an image nor a node: the name itself as a text wordmark
  const inner = l.node != null ? h("span", { class: "m-logo-node" }, l.node)
    : !l.src ? h("span", { class: "m-logo-name" }, l.name)
    : h(Picture, { src: l.src ?? "", alt: l.name, width: l.width, height: l.height, class: "m-logo-img" });
  return l.href ? h("a", { class: "m-logo", href: l.href, "aria-label": l.node != null ? l.name : null }, inner) as Element : h("span", { class: "m-logo" }, inner) as Element;
}

/** `<LogoCloud title="Trusted by" logos={[{ name: "HADİ", src: "/hadi.svg", width: 120, height: 32 }]} variant="marquee" />` */
export function LogoCloud(props: LogoCloudProps): Element {
  const variant = props.variant ?? "grid";
  const logos = props.logos ?? []; // no logos yet (a raw component in the IDE): only the title, not an error
  const body = variant === "marquee"
    // Marquee repeats the row until the strip is wider than the screen (the copies are hidden from screen readers)
    ? h(Marquee, { class: "m-logos-marquee", speed: props.speed ?? 40, pause: 0, separator: false, duplicate: true }, h("span", { class: "m-logos-row" }, logos.map(logoNode)))
    : h(Grid, { min: "9rem", gap: 3, class: "m-logos-cells" }, logos.map((l) => h("div", { class: "m-logos-cell" }, logoNode(l))));
  const root = h("div", { class: cx("m-logos", `m-logos-v-${variant}`, props.mono !== false && "is-mono", val(props.class)) },
    props.title != null && h("p", { class: "m-logos-title" }, () => val(props.title)),
    body) as HTMLElement;
  if (variant === "grid" && props.reveal !== "none") owned(revealOnScroll(root, { effect: props.reveal ?? "fade", select: ".m-logos-cell", stagger: 50 }));
  return root;
}
