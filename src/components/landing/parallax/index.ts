// Parallax (hadi-march/landing): layered depth. Each layer (an image or any node, placed with Overlay) moves at its own
// speed while the section scrolls past, and — with `pointer` — shifts with the mouse by its depth, smoothed on the motion
// engine's clock. Transform only; layers get room to travel so no edge ever shows. Reduced motion: still layers.
import "./parallax.css";
import { h } from "../../../dom/h.ts";
import { onCleanup, getOwner } from "../../../core/reactive.ts";
import { cx, val, listen, setStyle, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { Overlay, type OverlayProps } from "../../../ui/overlay.ts";
import { onFrame } from "../../../motion/engine/clock.ts";
import { reducedMotion } from "../../../motion/engine/prefs.ts";
import { scrollScene } from "../../../motion/scroll-scene.ts";

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

  // scroll offset (px per layer) and pointer offset (−1..1, smoothed)
  let scrollP = 0.5, height = 0;
  const goal = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  const write = (): void => {
    const still = reducedMotion();
    props.layers.forEach((l, i) => {
      const el = layerEls[i];
      if (!el) return;
      if (still) { setStyle(el, { transform: null }); return; }
      const sp = l.speed ?? 0.2, d = (l.depth ?? sp * 60) * (props.pointer ?? 0);
      const y = (scrollP - 0.5) * height * sp + cur.y * d, x = cur.x * d;
      setStyle(el, { transform: `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)` });
    });
  };
  scrollScene(root, (s) => { scrollP = s.progress; height = s.height; write(); });
  if (props.pointer) {
    let loop: (() => void) | null = null;
    const ease = (_t: number, dt: number): void => {
      const k = 1 - Math.exp(-dt / 140);
      cur.x += (goal.x - cur.x) * k; cur.y += (goal.y - cur.y) * k;
      write();
      if (Math.abs(goal.x - cur.x) < 0.001 && Math.abs(goal.y - cur.y) < 0.001) { loop?.(); loop = null; }
    };
    const start = (): void => { if (!loop && !reducedMotion()) loop = onFrame(ease, { phase: "write" }); };
    const off = listen(root, {
      pointermove: (e: PointerEvent) => { const r = root.getBoundingClientRect(); goal.x = ((e.clientX - r.left) / r.width - 0.5) * 2; goal.y = ((e.clientY - r.top) / r.height - 0.5) * 2; start(); },
      pointerleave: () => { goal.x = 0; goal.y = 0; start(); },
    });
    if (getOwner()) onCleanup(() => { off(); loop?.(); });
  }
  return root;
}
