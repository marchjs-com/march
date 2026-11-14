// Overlay (hadi-march/ui): a decorative layer that lives inside its container — an image, a muted looping video, an SVG,
// a canvas drawn by a function, or a CSS effect (glass, gradient, mesh, noise, vignette, spotlight, grid, dots). Layers
// stack in the order they are added (the first one is lowest); background layers sit under the container's content,
// `front` ones above it. Overlays never take input: clicks, hover, touch and the wheel go to what is underneath; they are
// inert and hidden from screen readers (an image with a meaningful `alt` excepted). Position, size and order are CSS
// variables set through CSSOM (no inline style attribute, CSP safe). Video and canvas code load as separate chunks.
import "./overlay.css";
import { signal, getOwner, effect } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { listen } from "../../../core/util.ts";
import { mediaKind } from "../media/kind.ts";
import { type ColorToken } from "../../../theme/colors.ts";

export type OverlayEffect = "glass" | "gradient" | "mesh" | "noise" | "vignette" | "spotlight" | "grid" | "dots";
export type OverlayFit = "cover" | "contain" | "fill" | "none" | "scale-down";
/** A length: a space step (0–8 → --m-space-n) or any CSS length ("12px", "10%"). */
export type OverlayLength = number | string;

/** What a draw function receives. */
export interface DrawContext {
  width: number; height: number; dpr: number;
  /** ms since the first frame (animate) */
  time: number;
  /** theme colors as CSS strings: primary, accent, text, surface, bg, cat (8) */
  theme: { primary: string; text: string; surface: string; bg: string; cat: string[] };
  /** pointer position over the container in CSS px (null when outside) */
  pointer: { x: number; y: number } | null;
}
export type DrawFn = (ctx: CanvasRenderingContext2D, info: DrawContext) => void;

export interface OverlayProps {
  /** Image or video URL (type from the extension, or `type`). */
  src?: MaybeFn<string | undefined>;
  type?: "image" | "video" | "svg";
  srcset?: string; sizes?: string;
  /** Video poster (also shown instead of the video on save-data / reduced motion). */
  poster?: string;
  /** A meaningful description; without it the overlay is decorative (aria-hidden). */
  alt?: string;
  /** Inline SVG (an element or a component result). */
  svg?: unknown;
  /** Draw on a canvas sized to the container (devicePixelRatio aware). */
  draw?: DrawFn;
  /** Redraw every frame (paused while not visible and with reduced motion). */
  animate?: boolean;
  effect?: OverlayEffect;
  fit?: OverlayFit;
  /** object-position ("center", "50% 20%"). */
  position?: string;
  inset?: OverlayLength; top?: OverlayLength; right?: OverlayLength; bottom?: OverlayLength; left?: OverlayLength;
  /** Logical edges (RTL aware). */
  start?: OverlayLength; end?: OverlayLength;
  opacity?: MaybeFn<number | undefined>;
  /** mix-blend-mode */
  blend?: string;
  /** Above the container's content (glass, foreground effects). Default: behind it. */
  front?: boolean;
  /** Explicit order instead of insertion order. */
  layer?: number;
  /** Rarely needed: let the overlay take pointer input. */
  interactive?: boolean;
  class?: ClassProp;
}

const SVG = /\.svg(\?|#|$)/i;
const len = (v: OverlayLength | undefined): string | null => (v == null ? null : typeof v === "number" ? `var(--m-space-${v}, ${v * 4}px)` : v);
let seq = 0;

/** True when heavy media should not run: save-data, 2G, or reduced motion. */
export const quietMedia = (): boolean => {
  const c = (globalThis.navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } } | undefined)?.connection;
  return !!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches || !!c?.saveData || /(^|-)2g$/.test(c?.effectiveType ?? "");
};

/**
 * `<div class="card"><Overlay src="/bg.webm" poster="/bg.jpg" /><Overlay effect="glass" front />…content…</div>`
 * `<Overlay draw={(ctx, { width, height, time, theme }) => …} animate />`, `<Overlay svg={<Pattern />} opacity={0.3} />`
 */
export function Overlay(props: OverlayProps): Element {
  const order = props.layer ?? ++seq;
  const kind = props.draw ? "canvas" : props.effect && !props.src && !props.svg ? "effect" : props.svg ? "svg"
    : props.type ?? (mediaKind(val(props.src)) === "video" ? "video" : SVG.test(String(val(props.src) ?? "")) ? "svg" : "image");
  const meaningful = kind === "image" && !!props.alt;
  // physical sides on request (left / right): part of the class list, so a class change keeps it
  const physical = props.left != null || props.right != null;
  const root = h("div", {
    class: () => cx("m-ov", `m-ov-${kind}`, props.effect && `m-ov-fx-${props.effect}`, props.front ? "m-ov-front" : "m-ov-behind", physical && "m-ov-physical", props.interactive && "is-interactive", val(props.class)),
    "aria-hidden": meaningful ? null : "true", inert: props.interactive ? null : "", }) as HTMLElement;
  // geometry and order: CSS variables (CSSOM)
  const set = (k: string, v: string | null): void => { if (v == null) root.style.removeProperty(k); else root.style.setProperty(k, v); };
  // front / behind and the opacity follow their props (a live prop changes the stacking, not only the class)
  effect(() => set("--m-ov-z", String(props.front ? 10 + order : -1000 + order)));
  const all = len(props.inset);
  set("--m-ov-top", len(props.top) ?? all); set("--m-ov-bottom", len(props.bottom) ?? all);
  set("--m-ov-start", len(props.start) ?? len(props.left) ?? all); set("--m-ov-end", len(props.end) ?? len(props.right) ?? all);
  if (physical) { set("--m-ov-left", len(props.left) ?? all); set("--m-ov-right", len(props.right) ?? all); }
  set("--m-ov-fit", props.fit ?? "cover"); set("--m-ov-pos", props.position ?? "center");
  if (props.blend) set("--m-ov-blend", props.blend);
  effect(() => { const o = val(props.opacity); set("--m-ov-opacity", o == null ? null : String(o)); });

  if (kind === "image") root.append(h("img", { class: "m-ov-media", src: () => val(props.src) ?? "", srcset: props.srcset ?? null, sizes: props.sizes ?? null, alt: props.alt ?? "", loading: "lazy", decoding: "async", draggable: "false" }) as Node);
  else if (kind === "svg") root.append((props.svg ?? h("img", { class: "m-ov-media", src: () => val(props.src) ?? "", alt: "", loading: "lazy", decoding: "async" })) as Node);
  else if (kind === "video") {
    const poster = props.poster ? h("img", { class: "m-ov-media m-ov-poster", src: props.poster, alt: "", decoding: "async" }) as HTMLElement : null;
    if (poster) root.append(poster);
    if (!quietMedia()) void import("./media.ts").then((m) => { if (root.isConnected || !getOwner()) m.mountVideo(root, String(val(props.src) ?? ""), props.poster, poster); });
  } else if (kind === "canvas") {
    void import("./media.ts").then((m) => m.mountCanvas(root, props.draw as DrawFn, !!props.animate && !quietMedia()));
  }

  // the container: positioned, isolated stacking context; pointer position for spotlight / draw
  let host: HTMLElement | null = null;
  const pointer = signal<{ x: number; y: number } | null>(null);
  const attach = (): void => {
    host = root.parentElement;
    if (!host) return;
    host.classList.add("m-ov-host");
    if (props.effect === "spotlight" || props.draw) {
      const move = (e: PointerEvent): void => {
        const r = (host as HTMLElement).getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        pointer.set({ x, y }); set("--m-ov-x", `${x}px`); set("--m-ov-y", `${y}px`);
        (root as HTMLElement & { mPointer?: unknown }).mPointer = { x, y };
      };
      const leave = (): void => { pointer.set(null); (root as HTMLElement & { mPointer?: unknown }).mPointer = null; };
      listen(host, { pointermove: move, pointerleave: leave });
    }
  };
  queueMicrotask(attach);
  return root;
}
