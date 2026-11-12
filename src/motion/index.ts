// hadi-march/motion — animations for March apps (separate module; the core does not grow). Side-effect free: import only
// what you use. To enable the extra `transition:` names (blur, fly + WAAPI fade/slide/scale) and `<For animate>` FLIP,
// call installTransitions() / installFlip() once, or import "hadi-march/motion/install" (does both).
// Everything honors prefers-reduced-motion and uses only transform/opacity via WAAPI or CSSOM.
// All of it runs on ONE engine (./engine): keyframes, timelines, easing, drivers, one clock, global control.

export { animate, stagger, type AnimateOptions, type Controls, type Frames } from "./animate.ts";
export { defineTransition, installTransitions, type TransitionOptions } from "./transitions.ts";
export { tween, spring, type Animated, type Animatable, type TweenOptions, type SpringOptions } from "./values.ts";
export { flip, installFlip, type FlipOptions } from "./flip.ts";
export { timeline, type Timeline, type StepOptions, type Target } from "./timeline.ts";
export { inView, reveal, scrollProgress, parallax, type InViewOptions } from "./scroll.ts";
export { scrollScene, refreshScenes, type SceneState, type SceneFn } from "./scroll-scene.ts";
export { sharedTransition } from "./shared-element.ts";
export { pageTransitions, transitionFrames, resolveTransition, navDirection, type PageTransitionOptions, type PageTransitionSpec, type PageTransitionType } from "./page.ts";
export { drag, swipe, press, magnet, tilt, type DragOptions } from "./gestures.ts";
export { reducedMotion, setReducedMotion, frame, frameLoop, animateEl } from "./env.ts";
export * as easing from "./easing.ts";

// the engine (new API)
export {
  keyframes, preset, getKeyframes, keyframeNames, keyframesCss, Playback, Effect,
  ease, defineEasing, easingNames, steps, springEase, bounceEase, toLinear, supportsLinear,
  normalize, Track, parseColor, mixColor,
  defineDriver, driverFor, cssVars, registerVar, canvas2d, webgl, DRIVER, COMPOSITOR,
  animateValue, track, onFrame, nextFrame, measure, mutate, yieldToMain,
  motion, defineMotion, viewTransition, MOTION_DEFAULTS, cssAnimations, frameMonitor, installPresets, PRESETS,
  type Timing, type KeyframesDef, type Ease, type EaseInput, type Driver, type Tracked, type TrackOptions,
  type MotionSettings, type MotionExtension, type CssControls, type FrameMonitor, type Canvas2DTarget, type WebGLTarget,
  type StaggerFn, type KeyframesInput, type Phase, type PresetName,
} from "./engine/index.ts";
// components of the "motion" category (src/components/motion, generated barrel)
export * from "../components/motion/index.ts";
