// hadi-march/motion — animations for March apps (separate module; the core does not grow). Side-effect free: import only
// what you use. To enable the extra `transition:` names (blur, fly + WAAPI fade/slide/scale) and `<For animate>` FLIP,
// call installTransitions() / installFlip() once, or import "hadi-march/motion/install" (does both).
// Everything honors prefers-reduced-motion and uses only transform/opacity via WAAPI or CSSOM.

export { animate, stagger, type AnimateOptions, type Controls, type Frames } from "./animate.ts";
export { defineTransition, installTransitions, type TransitionOptions } from "./transitions.ts";
export { tween, spring, type Animated, type Animatable, type TweenOptions, type SpringOptions } from "./values.ts";
export { flip, installFlip, type FlipOptions } from "./flip.ts";
export { timeline, type Timeline, type StepOptions, type Target } from "./timeline.ts";
export { inView, reveal, scrollProgress, parallax, type InViewOptions } from "./scroll.ts";
export { pageTransitions, type PageTransitionOptions } from "./page.ts";
export { drag, swipe, press, magnet, tilt, type DragOptions } from "./gestures.ts";
export { reducedMotion, setReducedMotion, frame } from "./env.ts";
export * as easing from "./easing.ts";
