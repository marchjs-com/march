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
import { owned } from "../../../ui/observe.ts";
import { Overlay } from "../../../ui/overlay.ts";
import { Badge } from "../../../ui/badge.ts";
import { Picture, type PictureSource } from "../../media/picture/index.ts";
import { Aurora } from "../../../fx/index.ts";
import { BRAND_COLORS, tokenColor } from "../../../theme/colors.ts";
import { still } from "../../../motion/engine/parts.ts";
import { scrollTimeline } from "../../../motion/scroll-fx.ts";
import { Reveal, type RevealOptions } from "../reveal/index.ts";
import { SectionHead, sectionActions, type SectionAction } from "../section-head/index.ts";
import { VideoBackground } from "../video-background/index.ts";
import { Parallax, type ParallaxLayer } from "../parallax/index.ts";
import { backdrop, type BackdropLayer } from "../backdrop.ts";

export type HeroVariant = "centered" | "split" | "video" | "mesh" | "aurora" | "product" | "parallax";
/** A call to action (the SectionAction of SectionHead). */
export type HeroAction = SectionAction;
export interface HeroImage extends PictureSource { alt: string; width: number; height: number }

export interface HeroProps {
  /** Look: centered (default), split, video, mesh, aurora, product or parallax. @tr Görünüm: centered (varsayılan), split, video, mesh, aurora, product ya da parallax. */
  variant?: HeroVariant | undefined;
  /** Small pill above the title ("New: …"). @tr Başlığın üstündeki küçük hap ("Yeni: …"). */
  eyebrow?: MaybeFn<unknown> | undefined;
  /** Makes the eyebrow a link. @tr Üst etiketi bir bağlantı yapar. */
  eyebrowHref?: string | undefined;
  /** The arrow after a linked eyebrow: true (default "→"), false, or your own node. @tr Bağlantılı üst etiketten sonraki ok: true (varsayılan "→"), false ya da kendi düğümünüz. */
  eyebrowArrow?: boolean | Node | undefined;
  /** The main heading. @tr Ana başlık. */
  title: MaybeFn<unknown>;
  /** Part of a string title drawn with the brand gradient. @tr Metin bir başlığın marka renk geçişiyle çizilen kısmı. */
  highlight?: string | undefined;
  /** Text under the title. @tr Başlığın altındaki metin. */
  lead?: MaybeFn<unknown> | undefined;
  /** Buttons (action objects or nodes); the first is primary. @tr Düğmeler (eylem nesneleri ya da düğümler); ilki birincildir. */
  actions?: readonly (HeroAction | Node)[] | undefined;
  /** Small text under the actions ("No card needed"). @tr Eylemlerin altındaki küçük metin ("Kart gerekmez"). */
  note?: MaybeFn<unknown> | undefined;
  /** split / product: an image (size reserved) or any node. @tr split / product: bir görsel (boyutu ayrılmış) ya da herhangi bir düğüm. */
  media?: HeroImage | Node | undefined;
  /** video variant. @tr video görünümü için. */
  video?: { src: string; poster?: string | undefined } | undefined;
  /** parallax variant. @tr parallax görünümü için. */
  layers?: readonly ParallaxLayer[] | undefined;
  /** Aurora colours (theme tokens by default). @tr Aurora renkleri (varsayılan olarak tema token'ları). */
  colors?: readonly string[] | undefined;
  /** Alignment of the copy: center or start (default depends on the variant). @tr Metnin hizası: center ya da start (varsayılanı görünüme göre değişir). */
  align?: "center" | "start" | undefined;
  /** md · lg (default) · screen (fills the viewport). @tr md · lg (varsayılan) · screen (görüntü alanını doldurur). */
  size?: "md" | "lg" | "screen" | undefined;
  /** Heading level of the title (default 1: the page title; 2 when the hero is not the top of the page). @tr Başlığın düzeyi (varsayılan 1: sayfa başlığı; hero sayfanın en üstünde değilse 2). */
  level?: 1 | 2 | undefined;
  /** The decorative layers of the variant (grid, mesh, aurora, dots, pointer light, grain): default true; false: none. @tr Görünümün süs katmanları (ızgara, mesh, aurora, noktalar, işaretçi ışığı, gren): varsayılan true; false: hiçbiri. */
  backdrop?: boolean | undefined;
  /** Entrance of the copy (default "up") and of the split media: a Reveal effect, your own `{ from, to }`, or "none". @tr Metnin (varsayılan "up") ve split medyasının girişi: bir Reveal efekti, kendi `{ from, to }` değeriniz ya da "none". */
  reveal?: RevealOptions["effect"];
  /** product: the window bar with three dots on the frame (default true). @tr product: çerçevedeki üç noktalı pencere çubuğu (varsayılan true). */
  frameBar?: boolean | undefined;
  /** product: the frame starts tilted and flattens as you scroll (default true). @tr product: çerçeve eğik başlar ve kaydırdıkça düzleşir (varsayılan true). */
  tilt?: boolean | undefined;
  /** Extra CSS class on the section (`.m-hero`). @tr Bölüme (`.m-hero`) eklenen ek CSS sınıfı. */
  class?: ClassProp | undefined;
  /** Extra content under the note. @tr Notun altındaki ek içerik. */
  children?: unknown | undefined;
}

const BACKDROPS: Partial<Record<HeroVariant, readonly BackdropLayer[]>> = {
  centered: [["grid", 0.7], "spotlight"],
  mesh: ["mesh", ["grid", 0.35], "spotlight", ["noise", 0.5]],
  product: [["dots", 0.5, "m-hero-dots"]],
  split: [["dots", 0.5, "m-hero-dots"]],
};

function titleNode(title: unknown, highlight?: string): unknown {
  if (typeof title !== "string" || !highlight || !title.includes(highlight)) return title;
  const [a, ...b] = title.split(highlight);
  return [a, h("span", { class: "m-hero-hl" }, highlight), b.join(highlight)];
}

/** Buttons for a list of actions (the first is primary): `sectionActions` of SectionHead with the hero's size. */
export const actionButtons = (actions: readonly (HeroAction | Node)[] | undefined, size: "md" | "lg" = "lg"): unknown[] => sectionActions(actions, size);

// hero media is on the first screen: it loads eagerly, with its size reserved
const mediaNode = (m: HeroImage | Node | undefined, cls: string): unknown => (m ? h("div", { class: cls }, h(Picture, { source: m, loading: "eager", class: "m-hero-img" })) : null);

/** `<Hero variant="mesh" eyebrow="New" title="Build faster" highlight="faster" lead="…" actions={[{ label: "Start", href: "/start" }]} />` */
export function Hero(props: HeroProps): Element {
  const variant = props.variant ?? "centered";
  const align = props.align ?? (variant === "split" ? "start" : "center");
  const plain = props.reveal === "none";
  const arrow = props.eyebrowArrow === false ? null
    : h("span", { class: "m-hero-eyebrow-arrow", "aria-hidden": "true" }, props.eyebrowArrow && props.eyebrowArrow !== true ? props.eyebrowArrow : "→");
  const pill = (): unknown => h(Badge, { tone: "primary" }, () => val(props.eyebrow));
  // the copy is the shared SectionHead at its largest scale; the eyebrow is a Badge pill (with an arrow when linked)
  const copy = h(SectionHead, {
    class: cx("m-hero-copy", `m-hero-copy-${align}`), size: "xl", width: "full", align, as: `h${props.level ?? 1}` as "h1",
    eyebrow: props.eyebrow != null ? (props.eyebrowHref ? [pill(), arrow] : pill()) : undefined, eyebrowHref: props.eyebrowHref,
    title: () => titleNode(val(props.title), props.highlight),
    lead: props.lead != null ? () => val(props.lead) : undefined,
    actions: props.actions, note: props.note != null ? () => val(props.note) : undefined,
    reveal: plain ? false : { effect: props.reveal ?? "up", stagger: 90, duration: 900 },
  }, props.children ?? null);

  const cls = cx("m-hero", `m-hero-v-${variant}`, `m-hero-size-${props.size ?? "lg"}`, val(props.class));
  if (variant === "video" && props.video) return h("section", { class: cls }, h(VideoBackground, { src: props.video.src, poster: props.video.poster, tint: "dark", class: "m-hero-stage" }, h("div", { class: "m-hero-inner" }, copy)));
  if (variant === "parallax") return h("section", { class: cls }, h(Parallax, { layers: props.layers ?? [], pointer: 1, class: "m-hero-stage", height: "100%" }, h("div", { class: "m-hero-inner" }, copy)));

  // the decorative layers of the variant: a recipe for the shared backdrop builder (landing/backdrop.ts)
  const bg = backdrop(props.backdrop === false ? false
    : variant === "aurora" ? [h(Aurora, { colors: props.colors ?? BRAND_COLORS.map(tokenColor) }) as Node, ["noise", 0.45]]
      : BACKDROPS[variant]);

  let stage: unknown = null;
  if (variant === "split") stage = plain ? h("div", { class: "m-hero-media-wrap" }, mediaNode(props.media, "m-hero-media"))
    : h(Reveal, { class: "m-hero-media-wrap", effect: "scale", self: true, delay: 200, duration: 1000 }, mediaNode(props.media, "m-hero-media"));
  if (variant === "product") {
    const frame = h("div", { class: "m-hero-frame" },
      h(Overlay, { effect: "glass", front: true, class: "m-hero-frame-glass" }),
      props.frameBar === false ? null : h("div", { class: "m-hero-frame-bar", "aria-hidden": "true" }, h("i", {}), h("i", {}), h("i", {})),
      mediaNode(props.media, "m-hero-frame-body")) as HTMLElement;
    const wrap = h("div", { class: "m-hero-product" }, frame) as HTMLElement;
    // tilted at first, flat once the frame is well into the viewport (Linear / Apple style)
    // (the motion core's scrollTimeline seeks the tilt by the frame's passage; reduced motion keeps it flat)
    if (!still(props.tilt)) {
      owned(scrollTimeline(frame, { transform: ["perspective(1400px) rotateX(22deg) scale(.9) translate3d(0, 40px, 0)", "perspective(1400px) rotateX(0deg) scale(1) translate3d(0, 0, 0)"] }, { track: wrap, range: [0, 0.5], easing: "out" }));
    }
    stage = wrap;
  }
  return h("section", { class: cls }, ...bg, h("div", { class: "m-hero-inner" }, copy, stage));
}

