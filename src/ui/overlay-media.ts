// Overlay video and canvas: a separate chunk, loaded only when an Overlay has a video or a draw function.
import type { DrawFn } from "./overlay.ts";

/** Muted, looping, inline, control-less video that plays only while visible. */
export function mountVideo(root: HTMLElement, src: string, poster: string | undefined, posterEl: HTMLElement | null): void {
  const v = document.createElement("video");
  v.className = "hm-ov-media";
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
  return { primary: v("--hm-primary"), text: v("--hm-text"), surface: v("--hm-surface"), bg: v("--hm-bg"), cat: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v(`--hm-cat-${i}`)) };
};

/** A canvas sized to the overlay (devicePixelRatio), redrawn on resize, every frame while visible when `animate`. */
export function mountCanvas(root: HTMLElement, draw: DrawFn, animate: boolean): void {
  const c = document.createElement("canvas");
  c.className = "hm-ov-media";
  root.append(c);
  const ctx = c.getContext("2d");
  if (!ctx) return;
  let w = 0, h = 0, dpr = 1, raf = 0, visible = true, t0 = 0;
  const frame = (now: number): void => {
    if (!t0) t0 = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    draw(ctx, { width: w, height: h, dpr, time: now - t0, theme: themeColors(root), pointer: (root as HTMLElement & { hmPointer?: { x: number; y: number } | null }).hmPointer ?? null });
    raf = animate && visible && root.isConnected ? requestAnimationFrame(frame) : 0;
  };
  const resize = (): void => {
    const r = root.getBoundingClientRect();
    dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
    w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    if (!raf) frame(performance.now());
  };
  const ro = new ResizeObserver(resize);
  ro.observe(root);
  const IO = globalThis.IntersectionObserver;
  if (IO) {
    const io = new IO((es) => { visible = es.some((e) => e.isIntersecting); if (visible && animate && !raf) raf = requestAnimationFrame(frame); }, { threshold: 0 });
    io.observe(root);
  }
  resize();
}
