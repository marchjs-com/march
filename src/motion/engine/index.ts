// March motion engine: one keyframe-based engine for every animation.
//   value layer  keyframes(), tracks (numbers, vectors, OKLab colors, CSS strings), easing registry, stagger
//   playback     animate() / timeline(): play, pause, reverse, seek, rate, labels, callbacks, finished
//   drivers      dom (WAAPI first), cssVar (@property), object, canvas2d, webgl, defineDriver()
//   clock        one rAF loop, read / update / write / render phases, global speed and pause, off-screen skip
//   control      motion.config / pauseAll / resumeAll / reduced, cssAnimations(), frameMonitor(), viewTransition()
export { animate, timeline, stagger, Playback, Effect, type AnimateOptions, type StepOptions, type Target, type KeyframesInput, type StaggerFn } from "./playback.ts";
export { keyframes, preset, getKeyframes, keyframeNames, keyframesCss, type Timing, type KeyframesDef } from "./keyframes.ts";
export { ease, defineEasing, easingNames, cubicBezier, steps, springEase, bounceEase, toLinear, supportsLinear, linear, type Ease, type EaseInput, type SpringOptions } from "./ease.ts";
export { normalize, Track, type Frames, type Value } from "./tracks.ts";
export { parseColor, mixColor, formatOklab } from "./color.ts";
export { defineDriver, driverFor, domDriver, objectDriver, cssVarDriver, cssVars, registerVar, DRIVER, COMPOSITOR, type Driver, type CssVarTarget } from "./drivers.ts";
export { canvas2d, webgl, type Canvas2DTarget, type WebGLTarget } from "./canvas.ts";
export { animateValue, track, type Tracked, type TrackOptions } from "./value.ts";
export { onFrame, nextFrame, measure, mutate, now, yieldToMain, manualClock, step, type Phase, type FrameOptions } from "./clock.ts";
export { motion, defineMotion, viewTransition, type MotionExtension } from "./motion.ts";
export { DEFAULTS as MOTION_DEFAULTS, type MotionSettings, type Character, type ReduceMode } from "./config.ts";
export { cssAnimations, installCssControl, type CssControls } from "./css-control.ts";
export { frameMonitor, type FrameMonitor } from "./monitor.ts";
export { installPresets, PRESETS, type PresetName } from "./presets.ts";
export { isVisible, watchVisibility } from "./visibility.ts";
export { reducedMotion } from "./prefs.ts";
