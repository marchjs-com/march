// Overlay video and canvas: a separate chunk, loaded only when an Overlay has a video or a draw function.
import type { DrawFn } from "./index.ts";
import { frameLoop } from "../../../motion/env.ts";

/** Muted, looping, inline, control-less video that plays only while visible. */
export function mountVideo(root: HTMLElement, src: string, poster: string | undefined, posterEl: HTMLElement | null): void {
  const v = document.createElement("video");
  v.className = "m-ov-media";
  v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.autoplay = false; v.controls = false;
  v.preload = "metadata";
  for (const a of ["muted", "loop", "playsinline", "disablepictureinpicture", "disableremoteplayback"]) v.setAttribute(a, "");
  v.setAttribute("tabindex", "-1");
  if (poster) v.poster = poster;
  v.src = src;
  root.append(v);
  v.addEventListener("playing", () => posterEl?.remove(), { once: true });
  const IO = globalThis.IntersectionObserver;
  const play = (): void => { void v.play().catch(() => { /* blocked or no codec: the poster stays */ }); };
  if (!IO) { play(); return; }
  const io = new IO((es) => { for (const e of es) if (e.isIntersecting) play(); else v.pause(); }, { threshold: 0.05 });
  io.observe(root);
  // stop when the overlay leaves the document
  const mo = new MutationObserver(() => { if (!root.isConnected) { io.disconnect(); mo.disconnect(); v.pause(); v.removeAttribute("src"); v.load(); } });
  mo.observe(document.body, { childList: true, subtree: true });
}

const themeColors = (el: Element): { primary: string; text: string; surface: string; bg: string; cat: string[] } => {
  const cs = getComputedStyle(el);
  const v = (n: string): string => cs.getPropertyValue(n).trim();
  return { primary: v("--m-primary"), text: v("--m-text"), surface: v("--m-surface"), bg: v("--m-bg"), cat: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v(`--m-cat-${i}`)) };
};

/** A canvas sized to the overlay (devicePixelRatio), redrawn on resize, every frame while visible when `animate`. */
export function mountCanvas(root: HTMLElement, draw: DrawFn, animate: boolean): void {
  const c = document.createElement("canvas");
  c.className = "m-ov-media";
  root.append(c);
  const ctx = c.getContext("2d");
  if (!ctx) return;
  // the engine's clock drives the loop: global speed, "pause all" and off-screen stop reach the canvas too
  let w = 0, h = 0, dpr = 1, visible = true, time = 0, stop: (() => void) | null = null;
  // a twin: the copy of this canvas in a painted theme wave's veil (march/motion themeWave), drawn by the same
  // function at the same moment, in the colours where it sits (the old look), until the wave is over
  let twin: CanvasRenderingContext2D | null = null;
  const pointer = (): { x: number; y: number } | null => (root as HTMLElement & { mPointer?: { x: number; y: number } | null }).mPointer ?? null;
  const paintOn = (g: CanvasRenderingContext2D, colorsOf: HTMLElement): void => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    draw(g, { width: w, height: h, dpr, time, theme: themeColors(colorsOf), pointer: pointer() });
  };
  const paint = (): void => {
    paintOn(ctx, root);
    if (twin) paintOn(twin, (twin.canvas.parentElement ?? root));
  };
  c.addEventListener("m-wave-twin", (e) => {
    const d = (e as CustomEvent<{ copy: HTMLCanvasElement; claimed: boolean; stop?: () => void }>).detail;
    d.copy.width = c.width; d.copy.height = c.height;
    twin = d.copy.getContext("2d");
    d.claimed = !!twin;
    d.stop = () => { twin = null; };
    if (twin) paintOn(twin, d.copy.parentElement ?? root);
  });
  const run = (): void => {
    if (stop || !animate || !visible || !root.isConnected) return;
    stop = frameLoop((dt) => {
      if (!visible || !root.isConnected) { stop?.(); stop = null; return; }
      time += Math.min(dt, 100);
      paint();
    });
  };
  const resize = (): void => {
    const r = root.getBoundingClientRect();
    dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
    w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    paint();
    run();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(root);
  const IO = globalThis.IntersectionObserver;
  if (IO) {
    const io = new IO((es) => { visible = es.some((e) => e.isIntersecting); if (visible) run(); }, { threshold: 0 });
    io.observe(root);
  }
  // the first size comes from the observer, after the browser's own layout: measuring here would force a layout while
  // the page is still being built (a stall when a page with a canvas opens)
}
