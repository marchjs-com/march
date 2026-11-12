// LogoCloud (hadi-march/landing): "trusted by" logos. `grid` lines them up (equal cells, they light up on hover);
// `marquee` runs them as an endless ticker (Marquee: fades at the edges, stops off screen, reduced motion keeps it
// still, screen readers read each name once). Logos are muted to one tone by default so no brand shouts.
import "./logo-cloud.css";
import { h } from "../../../dom/h.ts";
import { onCleanup, getOwner } from "../../../core/reactive.ts";
import { cx, val, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { Marquee } from "../../../ui/marquee.ts";
import { Grid } from "../../../ui/stack.ts";
import { revealOnScroll } from "../reveal/index.ts"; // Reveal: the grid cells fade in one after another

export interface Logo {
  /** Accessible name (company). */
  name: string;
  /** Image URL (SVG or PNG); give width / height to reserve the space. */
  src?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  /** Or any node (an inline SVG). */
  node?: unknown | undefined;
  href?: string | undefined;
}
export interface LogoCloudProps {
  logos: readonly Logo[];
  variant?: "grid" | "marquee" | undefined;
  /** Small heading above ("Trusted by teams at"). */
  title?: MaybeFn<unknown> | undefined;
  /** One muted tone, full colour on hover (default true). */
  mono?: boolean | undefined;
  /** Marquee speed, px/s (default 40). */
  speed?: number | undefined;
  class?: ClassProp | undefined;
}

function logoNode(l: Logo): Element {
  const inner = l.node != null ? h("span", { class: "hm-logo-node" }, l.node)
    : h("img", { src: l.src ?? "", alt: l.name, width: l.width ?? null, height: l.height ?? null, loading: "lazy", decoding: "async", class: "hm-logo-img" });
  return l.href ? h("a", { class: "hm-logo", href: l.href, "aria-label": l.node != null ? l.name : null }, inner) as Element : h("span", { class: "hm-logo" }, inner) as Element;
}

/** `<LogoCloud title="Trusted by" logos={[{ name: "Acme", src: "/acme.svg", width: 120, height: 32 }]} variant="marquee" />` */
export function LogoCloud(props: LogoCloudProps): Element {
  const variant = props.variant ?? "grid";
  const body = variant === "marquee"
    // two copies in the item so the strip is wider than the screen; Marquee adds the seamless loop copy
    ? h(Marquee, { class: "hm-logos-marquee", speed: props.speed ?? 40, pause: 0, separator: "" },
      h("span", { class: "hm-logos-row" }, props.logos.map(logoNode), h("span", { class: "hm-logos-row-copy", "aria-hidden": "true", inert: "" }, props.logos.map(logoNode))))
    : h(Grid, { min: "9rem", gap: 3, class: "hm-logos-cells" }, props.logos.map((l) => h("div", { class: "hm-logos-cell" }, logoNode(l))));
  const root = h("div", { class: cx("hm-logos", `hm-logos-v-${variant}`, props.mono !== false && "is-mono", val(props.class)) },
    props.title != null && h("p", { class: "hm-logos-title" }, () => val(props.title)),
    body) as HTMLElement;
  if (variant === "grid") { const stop = revealOnScroll(root, { effect: "fade", select: ".hm-logos-cell", stagger: 50 }); if (getOwner()) onCleanup(stop); }
  return root;
}
