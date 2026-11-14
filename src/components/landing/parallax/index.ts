// Parallax (hadi-march/landing): layered depth. Each layer (an image or any node, placed with Overlay) moves at its own
// speed while the section scrolls past (motion parallaxLayers), and — with `pointer` — shifts with the mouse by its depth
// (motion hoverParallax). Transform only; layers get room to travel so no edge ever shows. Reduced motion: still layers.
import "./parallax.css";
import { h } from "../../../dom/h.ts";
import { cx, val, setStyle, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { owned } from "../../../ui/observe.ts";
import { Overlay, type OverlayProps } from "../../../ui/overlay.ts";
import { parallaxLayers } from "../../../motion/scroll-fx.ts";

export interface ParallaxLayer {
  /** Image URL (or use `content`). */
  src?: string | undefined;
  alt?: string | undefined;
  /** Any node (SVG, shapes, text). */
  content?: unknown | undefined;
  /** Scroll speed: 0 = fixed to the section, 0.3 = slower than the page (far), −0.2 = faster (near). */
  speed?: number | undefined;
  /** Mouse depth in px at the edge of the section (default speed × 60). */
  depth?: number | undefined;
  /** Extra room around the layer so it can travel (default 12 %). */
  bleed?: string | undefined;
  opacity?: number | undefined;
  blend?: string | undefined;
  class?: ClassProp | undefined;
}
export interface ParallaxProps {
  layers: readonly ParallaxLayer[];
  /** Follow the mouse too (strength multiplier, default 0 = off). */
  pointer?: number | undefined;
  /** Minimum height (CSS length, default 26rem). */
  height?: string | undefined;
  class?: ClassProp | undefined;
  children?: unknown | undefined;
}

/** `<Parallax layers={[{ src: "/sky.jpg", speed: .5 }, { src: "/hills.png", speed: .25 }, { content: <Logo/>, speed: -.1 }]} pointer={1}>…</Parallax>` */
export function Parallax(props: ParallaxProps): Element {
  const layerEls = props.layers.map((l, i) => h(Overlay, {
    ...(l.src ? { src: l.src, alt: l.alt } : { svg: h("div", { class: "hm-plx-node" }, l.content) }),
    inset: `-${l.bleed ?? "12%"}`, opacity: l.opacity, blend: l.blend, layer: i + 1, class: cx("hm-plx-layer", val(l.class as MaybeFn<unknown>)),
  } as OverlayProps) as HTMLElement);
  const root = h("div", { class: cx("hm-plx", val(props.class)) }, layerEls, h("div", { class: "hm-plx-content" }, props.children)) as HTMLElement;
  if (props.height) setStyle(root, { "--hm-plx-h": props.height });

  // scroll: the motion core's parallaxLayers seeks each layer by the section's passage (far layers lag: negative depth);
  // pointer: hoverParallax shifts the layer contents by their depth with a spring. Reduced motion: still layers.
  layerEls.forEach((el, i) => {
    const l = props.layers[i]!;
    el.setAttribute("data-depth", String(-(l.speed ?? 0.2)));
    const inner = el.firstElementChild as HTMLElement | null;
    if (inner) inner.setAttribute("data-depth", String((l.depth ?? (l.speed ?? 0.2) * 60) / 60));
  });
  const offs = [parallaxLayers(root, { selector: ".hm-plx-layer", strength: 420 })];
  let live = true;
  // the pointer layer comes with motion/micro (ripple, state morph…): loaded only when a parallax follows the mouse
  if (props.pointer) void import("../../../motion/micro.ts").then((m) => { if (live) offs.push(m.hoverParallax(root, { depth: 60 * (props.pointer ?? 1), selector: ".hm-plx-layer > [data-depth]" })); });
  owned(() => { live = false; offs.forEach((f) => f()); });
  return root;
}
