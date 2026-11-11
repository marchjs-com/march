// Enter/leave transitions for the `transition:` directive: fade, slide, scale, blur, fly. Registered when
// hadi-march/motion is imported. Leaving elements stay in the DOM until their animation finished.
import { registerTransition } from "../dom/h.js";
import { animate, type Frames } from "./animate.ts";

export interface TransitionOptions { duration?: number; delay?: number; easing?: string; x?: number; y?: number; amount?: number; start?: number }
type Maker = (o: TransitionOptions) => Frames;

const MAKERS: Record<string, Maker> = {
  fade: () => [{ opacity: 0 }, { opacity: 1 }],
  slide: (o) => [{ opacity: 0, transform: `translateY(${o.y ?? -8}px)` }, { opacity: 1, transform: "none" }],
  scale: (o) => [{ opacity: 0, transform: `scale(${o.start ?? 0.95})` }, { opacity: 1, transform: "none" }],
  blur: (o) => [{ opacity: 0, filter: `blur(${o.amount ?? 8}px)` }, { opacity: 1, filter: "blur(0)" }],
  fly: (o) => [{ opacity: 0, transform: `translate(${o.x ?? 0}px, ${o.y ?? 24}px)` }, { opacity: 1, transform: "none" }],
};

/** Define a custom transition: `defineTransition("pop", (o) => [{ transform: "scale(.5)" }, { transform: "none" }])`. */
export function defineTransition(name: string, make: Maker): void {
  MAKERS[name] = make;
  registerTransition(name, (el: Element, raw: unknown, dir: "in" | "out") => {
    const o = (raw && typeof raw === "object" ? raw : {}) as TransitionOptions;
    const frames = make(o);
    const list = Array.isArray(frames) ? frames : [frames];
    const seq = dir === "in" ? list : [...list].reverse();
    return animate(el, seq as Frames, { duration: o.duration ?? (dir === "in" ? 220 : 160), delay: dir === "in" ? o.delay ?? 0 : 0, easing: o.easing ?? (dir === "in" ? "easeOutCubic" : "easeInCubic") }).finished;
  });
}

export function installTransitions(): void {
  for (const [name, make] of Object.entries(MAKERS)) defineTransition(name, make);
}
