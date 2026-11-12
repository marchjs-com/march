// Hero (hadi-march/landing): the first screen of a website, in seven looks that share one structure — an eyebrow pill,
// a large title (a highlighted part gets the brand gradient), a lead, actions and a note — plus a stage that changes by
// variant:
//   centered  calm, centred copy over a soft grid
//   split     copy at the start, media at the end (stacks on phones)
//   video     a VideoBackground behind the copy
//   mesh      a gradient mesh with a pointer spotlight and grain
//   aurora    drifting colour blobs (hadi-march/fx Aurora)
//   product   copy, then a product frame that tilts in 3D and flattens as you scroll (Overlay glass, scrollTimeline)
//   parallax  layered depth behind the copy (Parallax)
// The copy enters with Reveal; hero media loads eagerly with its size reserved (no layout shift).
import "./hero.css";
import { h } from "../../../dom/h.ts";
import { cx, val, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { Overlay } from "../../../ui/overlay.ts";
import { Button, type ButtonVariant } from "../../../ui/button.ts";
import { Badge } from "../../../ui/badge.ts";
import { Aurora } from "../../../fx/index.ts";
import { reducedMotion } from "../../../motion/engine/prefs.ts";
import { scrollTimeline } from "../../../motion/scroll-fx.ts";
import { onCleanup, getOwner } from "../../../core/reactive.ts";
import { Reveal } from "../reveal/index.ts";
import { VideoBackground } from "../video-background/index.ts";
import { Parallax, type ParallaxLayer } from "../parallax/index.ts";

export type HeroVariant = "centered" | "split" | "video" | "mesh" | "aurora" | "product" | "parallax";
export interface HeroAction { label: unknown; href?: string | undefined; onClick?: (e: MouseEvent) => void | undefined; variant?: ButtonVariant | undefined; icon?: unknown | undefined; iconEnd?: unknown | undefined }
export interface HeroImage { src: string; alt: string; width: number; height: number; srcset?: string | undefined; sizes?: string | undefined }

export interface HeroProps {
  variant?: HeroVariant | undefined;
  /** Small pill above the title ("New: …"). */
  eyebrow?: MaybeFn<unknown> | undefined;
  /** Makes the eyebrow a link. */
  eyebrowHref?: string | undefined;
  title: MaybeFn<unknown>;
  /** Part of a string title drawn with the brand gradient. */
  highlight?: string | undefined;
  lead?: MaybeFn<unknown> | undefined;
  actions?: readonly (HeroAction | Node)[] | undefined;
  /** Small text under the actions ("No card needed"). */
  note?: MaybeFn<unknown> | undefined;
  /** split / product: an image (size reserved) or any node. */
  media?: HeroImage | Node | undefined;
  /** video variant. */
  video?: { src: string; poster?: string | undefined } | undefined;
  /** parallax variant. */
  layers?: readonly ParallaxLayer[] | undefined;
  /** Aurora colours (theme tokens by default). */
  colors?: readonly string[] | undefined;
  align?: "center" | "start" | undefined;
  /** md · lg (default) · screen (fills the viewport). */
  size?: "md" | "lg" | "screen" | undefined;
  /** Heading level of the title (default 1: the page title; 2 when the hero is not the top of the page). */
  level?: 1 | 2 | undefined;
  class?: ClassProp | undefined;
  children?: unknown | undefined;
}

const isImage = (m: unknown): m is HeroImage => !!m && typeof m === "object" && typeof (m as HeroImage).src === "string" && !(m as Node).nodeType;

function titleNode(title: unknown, highlight?: string): unknown {
  if (typeof title !== "string" || !highlight || !title.includes(highlight)) return title;
  const [a, ...b] = title.split(highlight);
  return [a, h("span", { class: "hm-hero-hl" }, highlight), b.join(highlight)];
}

/** Buttons for a list of actions (the first is primary): shared by Hero, CtaBand, Pricing. */
export function actionButtons(actions: readonly (HeroAction | Node)[] | undefined, size: "md" | "lg" = "lg"): unknown[] {
  return (actions ?? []).map((a, i) => {
    if ((a as Node).nodeType) return a;
    const x = a as HeroAction;
    return h(Button, { variant: x.variant ?? (i === 0 ? "primary" : "secondary"), size, href: x.href as never, onClick: x.onClick, icon: x.icon, iconEnd: x.iconEnd }, x.label);
  });
}

function mediaNode(m: HeroImage | Node | undefined, cls: string): unknown {
  if (!m) return null;
  if (!isImage(m)) return h("div", { class: cls }, m);
  return h("div", { class: cls }, h("img", { src: m.src, alt: m.alt, width: m.width, height: m.height, srcset: m.srcset ?? null, sizes: m.sizes ?? null, decoding: "async", fetchpriority: "high", class: "hm-hero-img" }));
}

/** `<Hero variant="mesh" eyebrow="New" title="Build faster" highlight="faster" lead="…" actions={[{ label: "Start", href: "/start" }]} />` */
export function Hero(props: HeroProps): Element {
  const variant = props.variant ?? "centered";
  const align = props.align ?? (variant === "split" ? "start" : "center");
  const copy = h(Reveal, { class: cx("hm-hero-copy", `hm-hero-copy-${align}`), effect: "up", stagger: 90, duration: 900 },
    props.eyebrow != null && (props.eyebrowHref
      ? h("a", { class: "hm-hero-eyebrow", href: props.eyebrowHref }, h(Badge, { tone: "primary" }, () => val(props.eyebrow)), h("span", { class: "hm-hero-eyebrow-arrow", "aria-hidden": "true" }, "→"))
      : h("p", { class: "hm-hero-eyebrow" }, h(Badge, { tone: "primary" }, () => val(props.eyebrow)))),
    h(`h${props.level ?? 1}`, { class: "hm-hero-title" }, () => titleNode(val(props.title), props.highlight)),
    props.lead != null && h("p", { class: "hm-hero-lead" }, () => val(props.lead)),
    props.actions?.length ? h("div", { class: "hm-hero-actions" }, actionButtons(props.actions)) : null,
    props.note != null && h("p", { class: "hm-hero-note" }, () => val(props.note)),
    props.children ?? null);

  const cls = cx("hm-hero", `hm-hero-v-${variant}`, `hm-hero-size-${props.size ?? "lg"}`, val(props.class));
  if (variant === "video" && props.video) return h("section", { class: cls }, h(VideoBackground, { src: props.video.src, poster: props.video.poster, tint: "dark", class: "hm-hero-stage" }, h("div", { class: "hm-hero-inner" }, copy)));
  if (variant === "parallax") return h("section", { class: cls }, h(Parallax, { layers: props.layers ?? [], pointer: 1, class: "hm-hero-stage", height: "100%" }, h("div", { class: "hm-hero-inner" }, copy)));

  const bg: unknown[] = [];
  if (variant === "centered") bg.push(h(Overlay, { effect: "grid", opacity: 0.7 }), h(Overlay, { effect: "spotlight" }));
  if (variant === "mesh") bg.push(h(Overlay, { effect: "mesh" }), h(Overlay, { effect: "grid", opacity: 0.35 }), h(Overlay, { effect: "spotlight" }), h(Overlay, { effect: "noise", opacity: 0.5 }));
  if (variant === "aurora") bg.push(h(Aurora, { colors: props.colors ?? ["var(--hm-brand-orange, var(--hm-cat-1))", "var(--hm-brand-blue, var(--hm-cat-2))", "var(--hm-brand-green, var(--hm-cat-3))", "var(--hm-brand-purple, var(--hm-cat-4))"] }), h(Overlay, { effect: "noise", opacity: 0.45 }));
  if (variant === "product" || variant === "split") bg.push(h(Overlay, { effect: "dots", opacity: 0.5, class: "hm-hero-dots" }));

  let stage: unknown = null;
  if (variant === "split") stage = h(Reveal, { class: "hm-hero-media-wrap", effect: "scale", self: true, delay: 200, duration: 1000 }, mediaNode(props.media, "hm-hero-media"));
  if (variant === "product") {
    const frame = h("div", { class: "hm-hero-frame" },
      h(Overlay, { effect: "glass", front: true, class: "hm-hero-frame-glass" }),
      h("div", { class: "hm-hero-frame-bar", "aria-hidden": "true" }, h("i", {}), h("i", {}), h("i", {})),
      mediaNode(props.media, "hm-hero-frame-body")) as HTMLElement;
    const wrap = h("div", { class: "hm-hero-product" }, frame) as HTMLElement;
    // tilted at first, flat once the frame is well into the viewport (Linear / Apple style)
    // (the motion core's scrollTimeline seeks the tilt by the frame's passage; reduced motion keeps it flat)
    if (!reducedMotion()) {
      const stop = scrollTimeline(frame, { transform: ["perspective(1400px) rotateX(22deg) scale(.9) translate3d(0, 40px, 0)", "perspective(1400px) rotateX(0deg) scale(1) translate3d(0, 0, 0)"] }, { track: wrap, range: [0, 0.5], easing: "out" });
      if (getOwner()) onCleanup(stop);
    }
    stage = wrap;
  }
  return h("section", { class: cls }, ...bg, h("div", { class: "hm-hero-inner" }, copy, stage));
}

