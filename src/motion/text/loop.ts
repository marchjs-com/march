// Loops: continuous effects (iterations: Infinity by default; give `iterations` for a fixed count). They pause off
// screen and with "pause all"; with reduced motion they stay still. stop() puts the plain text back.
import { perPart, run, jitter as rnd, colorOf, type TextOptions, type TextAnimation } from "./core.ts";
import { css } from "./split.ts";

type El = HTMLElement;
type Anim = (el: El, o?: TextOptions) => TextAnimation;
const LOOP = { iterations: Infinity, direction: "alternate" as PlaybackDirection, easing: "in-out" };

/** Characters ripple up and down in a wave. */
export const wave: Anim = (el, o) => perPart(el, o, { ...LOOP, duration: 500, stagger: 60 }, () => ({ transform: ["translateY(0em)", "translateY(-0.35em)"] }));
/** Characters hop one after another. */
export const bounce: Anim = (el, o) => perPart(el, o, { iterations: Infinity, duration: 1200, stagger: 70, easing: "linear" }, () => [
  { transform: "translateY(0em) scale(1, 1)", easing: "cubic-bezier(.33,1,.68,1)" }, { transform: "translateY(-0.6em) scale(0.95, 1.05)", offset: 0.25, easing: "cubic-bezier(.32,0,.67,0)" },
  { transform: "translateY(0em) scale(1.1, 0.9)", offset: 0.45 }, { transform: "translateY(0em) scale(1, 1)", offset: 0.55 }, { transform: "translateY(0em) scale(1, 1)" },
]);
/** Characters tremble nervously. */
export const jitter: Anim = (el, o) => perPart(el, o, { iterations: Infinity, duration: 400, stagger: 0, easing: "linear" }, () =>
  [0, 1, 2, 3, 4].map((k) => ({ transform: k % 4 ? `translate(${rnd(1.5).toFixed(2)}px, ${rnd(1.5).toFixed(2)}px)` : "translate(0px, 0px)", easing: "steps(1, end)" })));
/** Words drift gently, as if under water. */
export const float: Anim = (el, o) => perPart(el, o, { ...LOOP, by: "word", duration: 2400, stagger: 300 }, (i) => ({ transform: ["translateY(0em) rotate(0deg)", `translateY(-0.18em) rotate(${i % 2 ? 2 : -2}deg)`] }));
/** Characters swell and shrink in turn. */
export const pulse: Anim = (el, o) => perPart(el, o, { ...LOOP, duration: 600, stagger: 80 }, () => ({ transform: ["scale(1)", "scale(1.25)"] }));
/** Characters cycle through the hues. */
export const rainbow: Anim = (el, o) => perPart(el, o, { iterations: Infinity, duration: 2400, stagger: 90, easing: "linear" }, () => ({ color: ["hsl(0 85% 55%)", "hsl(60 85% 45%)", "hsl(120 70% 40%)", "hsl(200 85% 50%)", "hsl(280 75% 58%)", "hsl(360 85% 55%)"] }));
/** A flickering neon sign (text-shadow glow). */
export const neon: Anim = (el, o) => perPart(el, o, { by: "word", iterations: Infinity, duration: 3000, stagger: 400, easing: "linear" }, () => {
  const on = { opacity: 1, textShadow: "0px 0px 4px currentColor, 0px 0px 14px currentColor", easing: "steps(1, end)" };
  const off = { opacity: 0.35, textShadow: "0px 0px 0px currentColor, 0px 0px 0px currentColor", easing: "steps(1, end)" };
  return [{ ...on, offset: 0 }, { ...off, offset: 0.08 }, { ...on, offset: 0.1 }, { ...off, offset: 0.5 }, { ...on, offset: 0.53 }, { ...off, offset: 0.56 }, { ...on, offset: 0.58 }, { ...on, offset: 1 }];
});
/** Letter spacing breathes in and out (letter-spacing). */
export const breathe: Anim = (el, o) => perPart(el, o, { ...LOOP, by: "line", duration: 1800 }, () => ({ letterSpacing: ["0em", "0.18em"], opacity: [1, 0.75] }));
/** A soft glow pulses behind the text (text-shadow). */
export const glow: Anim = (el, o) => perPart(el, o, { ...LOOP, by: "line", duration: 1400 }, () => ({ textShadow: ["0px 0px 0px currentColor", "0px 0px 18px currentColor"] }));
/** A light band sweeps across the text, over and over (gradient text). */
export const shimmer: Anim = (el, o) => {
  const c = colorOf(el);
  return run(el, o ?? {}, { by: "line", iterations: Infinity, duration: 1800, easing: "linear" }, (s, tl, r) => {
    for (const [i, p] of s.parts.entries()) {
      css(p, { "background-image": `linear-gradient(110deg, ${c} 35%, color-mix(in oklab, ${c} 20%, white) 50%, ${c} 65%)`, "background-size": "250% 100%", "-webkit-background-clip": "text", "background-clip": "text", color: "transparent" });
      tl.add(p, { backgroundPosition: ["100% 0%", "-150% 0%"] }, { at: 0, delay: r.at(i), duration: r.duration, easing: r.easing, iterations: r.iterations });
    }
  });
};
