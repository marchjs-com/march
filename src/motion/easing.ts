// Easing functions (t in 0..1 → progress). Names match the CSS `--m-ease-*` tokens.
export type Easing = (t: number) => number;

export const linear: Easing = (t) => t;
export const easeInCubic: Easing = (t) => t * t * t;
export const easeOutCubic: Easing = (t) => 1 - (1 - t) ** 3;
export const easeInOutCubic: Easing = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutQuart: Easing = (t) => 1 - (1 - t) ** 4;
export const easeOutExpo: Easing = (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t));
export const easeOutBack: Easing = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; };
export const easeOutElastic: Easing = (t) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1);
export const easeOutBounce: Easing = (t) => {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};

/** CSS-compatible cubic-bezier(x1, y1, x2, y2). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) { const e = sx(t) - x; const d = dx(t); if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break; t -= e / d; }
    return sy(Math.min(1, Math.max(0, t)));
  };
}

export const EASINGS: Record<string, Easing> = { linear, easeInCubic, easeOutCubic, easeInOutCubic, easeOutQuart, easeOutExpo, easeOutBack, easeOutElastic, easeOutBounce };
/** CSS equivalents for WAAPI (WAAPI only accepts CSS easing strings). */
export const CSS_EASINGS: Record<string, string> = {
  linear: "linear", easeInCubic: "cubic-bezier(.32,0,.67,0)", easeOutCubic: "cubic-bezier(.33,1,.68,1)", easeInOutCubic: "cubic-bezier(.65,0,.35,1)",
  easeOutQuart: "cubic-bezier(.25,1,.5,1)", easeOutExpo: "cubic-bezier(.16,1,.3,1)", easeOutBack: "cubic-bezier(.34,1.56,.64,1)",
  easeOutElastic: "cubic-bezier(.34,1.56,.64,1)", easeOutBounce: "cubic-bezier(.34,1.56,.64,1)",
};
export const resolveEasing = (e: string | Easing | undefined, fallback: Easing = easeOutCubic): Easing =>
  typeof e === "function" ? e : (e && EASINGS[e]) || fallback;
export const cssEasing = (e: string | Easing | undefined): string =>
  typeof e === "string" ? CSS_EASINGS[e] ?? e : "cubic-bezier(.33,1,.68,1)";
