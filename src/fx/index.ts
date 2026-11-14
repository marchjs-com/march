/// <reference path="../css.d.ts" />
// hadi-march/fx — decorative visuals for showcase pages: canvas particles, aurora background, confetti, spotlight.
// Separate, lazily loaded module. Canvas drawing and CSS custom properties only (CSP safe). Pauses when hidden or
// off screen; prefers-reduced-motion draws a single still frame.
import "./fx.css";
import { openLayer } from "../dom/portal.ts";
import { h } from "../dom/h.ts";
import { onCleanup } from "../core/reactive.ts";
import { reducedMotion, setStyle, frame } from "../motion/env.ts";
import { listen } from "../core/util.ts";

type Props = Record<string, unknown>;
const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown, d: string): string => (typeof v === "string" ? v : d);
const cssVar = (name: string, d: string): string => {
  const v = globalThis.getComputedStyle?.(globalThis.document.documentElement).getPropertyValue(name).trim();
  return v || d;
};

interface P { x: number; y: number; vx: number; vy: number; r: number }

/**
 * Floating particles with optional connecting lines and pointer attraction.
 * `<Particles count={80} links={120} speed={0.3} color="var(--m-primary)" interactive class="m-fx-fill" />`
 */
export function Particles(props: Props): HTMLCanvasElement {
  const canvas = h("canvas", { class: ["m-fx-canvas", props["class"]], "aria-hidden": "true", role: "presentation" }) as HTMLCanvasElement;
  const ctx = canvas.getContext?.("2d") ?? null;
  const count = num(props["count"], 70), speed = num(props["speed"], 0.35), linkDist = num(props["links"], 110);
  let w = 0, hgt = 0, dpr = 1, color = "#7c97ff";
  let parts: P[] = [];
  let mouse: { x: number; y: number } | null = null;
  let stop = (): void => {};
  let visible = true;

  // sized from getBoundingClientRect and kept by a ResizeObserver: a canvas built before it is on screen (detached,
  // hidden, or taken over from prerendered HTML) measures 0, so particles are only placed once it has a real size,
  // spread over the whole area; a later resize scales their positions with it
  const resize = (): void => {
    const r = canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const ow = w, oh = hgt;
    w = r.width; hgt = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(hgt * dpr);
    if (!parts.length) parts = Array.from({ length: count }, () => ({ x: Math.random() * w, y: Math.random() * hgt, vx: (Math.random() - 0.5) * speed, vy: (Math.random() - 0.5) * speed, r: 1 + Math.random() * 1.8 }));
    else if (ow > 0 && oh > 0 && (ow !== w || oh !== hgt)) for (const p of parts) { p.x *= w / ow; p.y *= hgt / oh; }
    color = resolveColor(str(props["color"], "var(--m-primary)"));
    draw();
  };
  const resolveColor = (c: string): string => { const m = /^var\((--[\w-]+)\)$/.exec(c); return m?.[1] ? cssVar(m[1], "#7c97ff") : c; };
  const draw = (): void => {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    for (const p of parts) { ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
    if (linkDist > 0) {
      ctx.lineWidth = 0.6;
      for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
        const a = parts[i], b = parts[j];
        if (!a || !b) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < linkDist) { ctx.globalAlpha = (1 - d / linkDist) * 0.35; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
    }
    ctx.globalAlpha = 1;
  };
  const step = (): void => {
    if (!visible || reducedMotion()) return;
    if (!parts.length) { resize(); stop = frame(step); return; }
    for (const p of parts) {
      if (mouse && props["interactive"]) { const dx = mouse.x - p.x, dy = mouse.y - p.y, d = Math.hypot(dx, dy) || 1; if (d < 140) { p.vx += (dx / d) * 0.02; p.vy += (dy / d) * 0.02; } }
      p.vx *= 0.995; p.vy *= 0.995;
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > hgt) p.vy *= -1;
    }
    draw();
    stop = frame(step);
  };
  // the canvas usually sits behind content (z-index), so it gets no pointer events of its own: follow the pointer on
  // the window, relative to the canvas box; touch and pens leave the particles drifting calmly
  const onMove = (e: PointerEvent): void => {
    if (e.pointerType && e.pointerType !== "mouse") { mouse = null; return; }
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    mouse = x >= 0 && y >= 0 && x <= r.width && y <= r.height ? { x, y } : null;
  };
  const onLeave = (): void => { mouse = null; };
  const onVis = (): void => { const was = visible; visible = globalThis.document.visibilityState !== "hidden"; if (visible && !was) step(); };
  queueMicrotask(() => {
    resize();
    stop = frame(step);
  });
  const ro = typeof globalThis.ResizeObserver === "function" ? new ResizeObserver(() => resize()) : null;
  ro?.observe(canvas);
  const off = props["interactive"] ? listen(globalThis.window, { pointermove: onMove, blur: onLeave }, { passive: true }) : () => {};
  const offVis = listen(globalThis.document, { visibilitychange: onVis });
  onCleanup(() => { stop(); ro?.disconnect(); off(); offVis(); });
  return canvas;
}

/** Animated, blurred color blobs behind content. `<Aurora colors={["#6d5dfc", "#22d3ee", "#a3e635"]} />` */
export function Aurora(props: Props): HTMLElement {
  const colors = Array.isArray(props["colors"]) ? (props["colors"] as unknown[]).map(String) : ["#6d5dfc", "#22d3ee", "#a3e635"];
  const el = h("div", { class: ["m-aurora", props["class"]], "aria-hidden": "true" },
    ...colors.slice(0, 4).map((c, i) => { const b = h("span", { class: `m-aurora-blob m-aurora-blob-${i + 1}` }) as HTMLElement; setStyle(b, { "--m-aurora-color": c }); return b; })) as HTMLElement;
  return el;
}

/** Pointer-following radial light on an element (sets --m-spot-x/--m-spot-y). `use:spotlight` */
export function spotlight(el: Element): () => void {
  const h2 = el as HTMLElement;
  el.classList.add("m-spotlight");
  const move = (e: PointerEvent): void => {
    const r = el.getBoundingClientRect();
    setStyle(el, { "--m-spot-x": `${e.clientX - r.left}px`, "--m-spot-y": `${e.clientY - r.top}px` });
  };
  return listen(h2, { pointermove: move });
}

/** Confetti burst from a point (defaults to the screen center). Removes its canvas when done. */
export function confetti({ x, y, count = 120, colors = ["#6d5dfc", "#3b82f6", "#22d3ee", "#a3e635", "#f59e0b", "#ef4444"], spread = 70 }: { x?: number; y?: number; count?: number; colors?: string[]; spread?: number } = {}): Promise<void> {
  const doc = globalThis.document;
  if (!doc || reducedMotion()) return Promise.resolve();
  const canvas = h("canvas", { class: "m-fx-confetti", "aria-hidden": "true" }) as HTMLCanvasElement;
  const close = openLayer("fx", canvas);
  const ctx = canvas.getContext?.("2d") ?? null;
  const W = globalThis.innerWidth || 800, H = globalThis.innerHeight || 600;
  canvas.width = W; canvas.height = H;
  const ox = x ?? W / 2, oy = y ?? H / 2;
  const bits = Array.from({ length: count }, () => {
    const a = ((-90 + (Math.random() - 0.5) * spread * 2) * Math.PI) / 180, v = 6 + Math.random() * 8;
    return { x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[Math.floor(Math.random() * colors.length)] ?? "#fff", life: 0 };
  });
  return new Promise((resolve) => {
    const tick = (): void => {
      if (!ctx) { close(); resolve(); return; }
      ctx.clearRect(0, 0, W, H);
      let alive = 0;
      for (const b of bits) {
        b.vy += 0.25; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.rot += b.vr; b.life++;
        if (b.y < H + 20 && b.life < 240) alive++;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.fillStyle = b.c; ctx.globalAlpha = Math.max(0, 1 - b.life / 240); ctx.fillRect(-4, -2, 8, 4); ctx.restore();
      }
      if (alive) frame(tick); else { close(); resolve(); }
    };
    frame(tick);
  });
}

/** Grain overlay wrapper: `<Noise>…</Noise>` (uses .m-noise). */
export function Noise(props: Props): HTMLElement {
  return h("div", { class: ["m-noise", props["class"]] }, () => props["children"]) as HTMLElement;
}
