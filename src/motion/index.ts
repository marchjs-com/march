// hadi-march/motion — animations for March apps (separate, lazily loaded module; the core does not grow).
// Importing it registers the extra `transition:` names (blur, fly + WAAPI versions of fade/slide/scale) and enables
// `<For animate>` FLIP. Everything honors prefers-reduced-motion and uses only transform/opacity via WAAPI or CSSOM.
import { installTransitions } from "./transitions.ts";
import { installFlip } from "./flip.ts";

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

installTransitions();
installFlip();
