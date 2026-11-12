// Entrances and exits: per-part keyframes. Every one plays as an exit with `{ out: true }` (backwards, ends hidden).
// Transforms stay on the compositor (WAAPI); filter / clip-path / letter-spacing ones are marked in their comment.
import { perPart, jitter, type TextOptions, type TextAnimation } from "./core.ts";
import { isRtl } from "./split.ts";

type El = HTMLElement;
type Anim = (el: El, o?: TextOptions) => TextAnimation;
const tf = (from: string, to: string): PropertyIndexedKeyframes => ({ transform: [from, to], opacity: [0, 1] });

/** Fade each character in. */
export const fade: Anim = (el, o) => perPart(el, o, { duration: 500 }, () => ({ opacity: [0, 1] }));
/** Characters appear in random order, like a slow dissolve. */
export const dissolve: Anim = (el, o) => perPart(el, o, { from: "random", duration: 900, stagger: 25, easing: "in-out" }, () => [{ opacity: 0 }, { opacity: 0.4, offset: 0.3 }, { opacity: 0.2, offset: 0.5 }, { opacity: 1 }]);
/** Words come into focus (filter). */
export const blurIn: Anim = (el, o) => perPart(el, o, { by: "word", duration: 800 }, () => ({ opacity: [0, 1], filter: ["blur(12px)", "blur(0px)"], transform: ["scale(1.15)", "scale(1)"] }));
/** Characters rise from below. */
export const rise: Anim = (el, o) => perPart(el, o, { duration: 600, easing: "expo" }, () => tf("translateY(100%)", "translateY(0%)"));
/** Characters drop from above. */
export const drop: Anim = (el, o) => perPart(el, o, { duration: 600, easing: "expo" }, () => tf("translateY(-100%)", "translateY(0%)"));
/** Characters slide in along the reading direction (mirrored for RTL). */
export const slideIn: Anim = (el, o) => { const s = isRtl(el) ? -1 : 1; return perPart(el, o, { duration: 600, easing: "expo" }, () => tf(`translateX(${-1.2 * s}em)`, "translateX(0em)")); };
/** Characters pop up with a small overshoot. */
export const pop: Anim = (el, o) => perPart(el, o, { duration: 500 }, () => [{ transform: "scale(0)", opacity: 0 }, { transform: "scale(1.3)", opacity: 1, offset: 0.6 }, { transform: "scale(1)", opacity: 1 }]);
/** Characters shrink into place from large. */
export const zoomIn: Anim = (el, o) => perPart(el, o, { duration: 600, easing: "expo" }, () => tf("scale(3)", "scale(1)"));
/** Characters flip down into place (3D). */
export const flip: Anim = (el, o) => perPart(el, o, { duration: 700, origin: "50% 0%", easing: "back" }, () => tf("perspective(400px) rotateX(-90deg)", "perspective(400px) rotateX(0deg)"));
/** Characters spin in from a half turn. */
export const rotateIn: Anim = (el, o) => perPart(el, o, { duration: 700, easing: "back" }, () => tf("rotate(-180deg) scale(0.3)", "rotate(0deg) scale(1)"));
/** Characters swing down from their top edge like signs on a hook. */
export const swing: Anim = (el, o) => perPart(el, o, { duration: 1000, origin: "50% 0%", easing: "linear" }, () => [
  { transform: "perspective(400px) rotateX(-100deg)", opacity: 0 }, { transform: "perspective(400px) rotateX(30deg)", opacity: 1, offset: 0.4 },
  { transform: "perspective(400px) rotateX(-15deg)", opacity: 1, offset: 0.65 }, { transform: "perspective(400px) rotateX(5deg)", opacity: 1, offset: 0.85 },
  { transform: "perspective(400px) rotateX(0deg)", opacity: 1 },
]);
/** Characters stretch in on an elastic spring. */
export const elastic: Anim = (el, o) => perPart(el, o, { easing: "elastic", stagger: 40 }, () => tf("scaleX(0.2) scaleY(1.6)", "scaleX(1) scaleY(1)"));
/** Characters fall and bounce on the baseline. */
export const bounceIn: Anim = (el, o) => perPart(el, o, { duration: 900, easing: "bounce", stagger: 50 }, () => tf("translateY(-1.6em)", "translateY(0em)"));
/** Words tilt in from the side (3D). */
export const tilt: Anim = (el, o) => { const s = isRtl(el) ? -1 : 1; return perPart(el, o, { by: "word", duration: 800, origin: s > 0 ? "0% 50%" : "100% 50%", easing: "expo" }, () => tf(`perspective(600px) rotateY(${70 * s}deg)`, "perspective(600px) rotateY(0deg)")); };
/** Words come forward out of the depth (3D). */
export const perspective: Anim = (el, o) => perPart(el, o, { by: "word", duration: 900, easing: "expo" }, () => tf("perspective(500px) translateZ(-400px) rotateX(50deg)", "perspective(500px) translateZ(0px) rotateX(0deg)"));
/** Characters slide in leaning forward. */
export const skewIn: Anim = (el, o) => { const s = isRtl(el) ? -1 : 1; return perPart(el, o, { duration: 600, easing: "expo" }, () => tf(`translateX(${s}em) skewX(${-40 * s}deg)`, "translateX(0em) skewX(0deg)")); };
/** Alternate characters come from above and below. */
export const splitReveal: Anim = (el, o) => perPart(el, o, { duration: 700, easing: "expo", stagger: 20 }, (i) => tf(`translateY(${i % 2 ? -110 : 110}%)`, "translateY(0%)"));
/** Words rise out of a mask (clip-path). */
export const maskReveal: Anim = (el, o) => perPart(el, o, { by: "word", duration: 800, easing: "expo" }, () => ({ clipPath: ["inset(100% 0% 0% 0%)", "inset(0% 0% 0% 0%)"], transform: ["translateY(40%)", "translateY(0%)"] }));
/** Lines are wiped on along the reading direction (clip-path). */
export const wipe: Anim = (el, o) => { const r = isRtl(el); return perPart(el, o, { by: "line", duration: 900, easing: "in-out" }, () => ({ clipPath: [r ? "inset(0% 0% 0% 100%)" : "inset(0% 100% 0% 0%)", "inset(0% 0% 0% 0%)"] })); };
/** Characters tumble down from above, turning. */
export const cascade: Anim = (el, o) => perPart(el, o, { duration: 800, easing: "back", stagger: 45 }, (i) => tf(`translateY(-2em) rotate(${i % 2 ? 40 : -40}deg)`, "translateY(0em) rotate(0deg)"));
/** Characters turn a full circle around their vertical axis. */
export const spin: Anim = (el, o) => perPart(el, o, { duration: 900, easing: "in-out", stagger: 50 }, () => ({ transform: ["perspective(400px) rotateY(-360deg)", "perspective(400px) rotateY(0deg)"], opacity: [0, 1, 1] }));
/** Characters wobble like jelly. */
export const jelly: Anim = (el, o) => perPart(el, o, { duration: 900, easing: "linear", stagger: 40 }, () => [
  { transform: "scale(1, 1)" }, { transform: "scale(1.3, 0.7)", offset: 0.3 }, { transform: "scale(0.75, 1.25)", offset: 0.4 },
  { transform: "scale(1.15, 0.85)", offset: 0.5 }, { transform: "scale(0.95, 1.05)", offset: 0.65 }, { transform: "scale(1.05, 0.95)", offset: 0.75 }, { transform: "scale(1, 1)" },
]);
/** Lines contract from wide letter spacing into focus (letter-spacing, filter). */
export const trackIn: Anim = (el, o) => perPart(el, o, { by: "line", duration: 900, easing: "expo" }, () => ({ letterSpacing: ["1em", "0em"], filter: ["blur(8px)", "blur(0px)"], opacity: [0, 1] }));
/** Characters fly in from scattered positions and assemble. */
export const implode: Anim = (el, o) => perPart(el, o, { duration: 1000, easing: "expo", stagger: 10, from: "random" }, () => tf(`translate(${jitter(4)}em, ${jitter(3)}em) rotate(${jitter(270)}deg) scale(${(Math.random() * 1.5 + 0.5).toFixed(2)})`, "translate(0em, 0em) rotate(0deg) scale(1)"));
/** Characters burst apart and vanish (an exit; `out: true` assembles them instead). */
export const explode: Anim = (el, o) => perPart(el, o, { duration: 900, easing: "in", stagger: 8, from: "center", exit: true }, () => ({ transform: ["translate(0em, 0em) rotate(0deg) scale(1)", `translate(${jitter(5)}em, ${jitter(4)}em) rotate(${jitter(360)}deg) scale(${(Math.random() * 1.5 + 0.3).toFixed(2)})`], opacity: [1, 0] }));
/** Words spread like ink on paper, from the middle out (filter). */
export const inkBleed: Anim = (el, o) => perPart(el, o, { by: "word", duration: 1100, easing: "out", from: "center" }, () => [
  { opacity: 0, filter: "blur(10px)", transform: "scale(1.5)" }, { opacity: 0.7, filter: "blur(4px)", transform: "scale(1.1)", offset: 0.45 }, { opacity: 1, filter: "blur(0px)", transform: "scale(1)" },
]);
/** Characters resolve in coarse steps, like a low-resolution image sharpening (filter). */
export const pixelate: Anim = (el, o) => perPart(el, o, { duration: 700, easing: "steps(5, end)", stagger: 35 }, () => ({ filter: ["blur(8px) contrast(4)", "blur(0px) contrast(1)"], opacity: [0, 1], transform: ["scale(1.4)", "scale(1)"] }));
/** A digital glitch: characters jump and split into color channels. */
export const glitch: Anim = (el, o) => perPart(el, o, { duration: 650, easing: "linear", stagger: 15, from: "random" }, () => {
  const f = (x: number, y: number, c: number): Keyframe => ({ transform: `translate(${x}px, ${y}px)`, textShadow: `${c}px 0px 0px rgb(255 0 128 / 0.8), ${-c}px 0px 0px rgb(0 220 255 / 0.8)`, easing: "steps(1, end)" });
  return [f(0, 0, 0), f(jitter(6), jitter(3), 3), f(jitter(6), jitter(3), -4), f(jitter(4), jitter(2), 2), f(jitter(3), jitter(2), -2), { ...f(0, 0, 0), easing: "linear" }];
});
/** Words shake side to side (attention). */
export const shake: Anim = (el, o) => perPart(el, o, { by: "word", duration: 600, easing: "linear", stagger: 30 }, () => ({ transform: ["translateX(0px)", "translateX(-8px)", "translateX(7px)", "translateX(-5px)", "translateX(4px)", "translateX(-2px)", "translateX(0px)"] }));
