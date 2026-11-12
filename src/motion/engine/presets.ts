// Built-in keyframes (transform / opacity / filter only: compositor-friendly). Not registered until
// installPresets() is called, so apps that do not use them do not ship them.
import { keyframes, type KeyframesDef } from "./keyframes.ts";

export const PRESETS = {
  fadeIn: [{ opacity: [0, 1] }, { duration: 220, easing: "out" }],
  fadeOut: [{ opacity: [1, 0] }, { duration: 180, easing: "in" }],
  fadeUp: [{ opacity: [0, 1], transform: ["translateY(16px)", "translateY(0px)"] }, { duration: 320, easing: "expo" }],
  fadeDown: [{ opacity: [0, 1], transform: ["translateY(-16px)", "translateY(0px)"] }, { duration: 320, easing: "expo" }],
  slideInStart: [{ opacity: [0, 1], transform: ["translateX(-32px)", "translateX(0px)"] }, { duration: 360, easing: "expo" }],
  slideInEnd: [{ opacity: [0, 1], transform: ["translateX(32px)", "translateX(0px)"] }, { duration: 360, easing: "expo" }],
  zoomIn: [{ opacity: [0, 1], transform: ["scale(.85)", "scale(1)"] }, { duration: 260, easing: "back" }],
  zoomOut: [{ opacity: [1, 0], transform: ["scale(1)", "scale(.85)"] }, { duration: 200, easing: "in" }],
  pop: [{ transform: ["scale(.6)", "scale(1)"], opacity: [0, 1] }, { easing: "spring-wobbly" }],
  blurIn: [{ opacity: [0, 1], filter: ["blur(12px)", "blur(0px)"] }, { duration: 420, easing: "out" }],
  flipIn: [{ opacity: [0, 1], transform: ["perspective(600px) rotateX(-80deg)", "perspective(600px) rotateX(0deg)"] }, { duration: 520, easing: "spring" }],
  bounceIn: [{ transform: ["translateY(-48px)", "translateY(0px)"] }, { duration: 900, easing: "bounce" }],
  shake: [{ transform: ["translateX(0px)", "translateX(-8px)", "translateX(8px)", "translateX(-6px)", "translateX(6px)", "translateX(-3px)", "translateX(0px)"] }, { duration: 480, easing: "linear" }],
  pulse: [{ transform: ["scale(1)", "scale(1.08)", "scale(1)"] }, { duration: 900, easing: "in-out", iterations: Infinity }],
  heartbeat: [{ transform: ["scale(1)", "scale(1.18)", "scale(1)", "scale(1.12)", "scale(1)"] }, { duration: 1100, easing: "in-out", iterations: Infinity }],
  wobble: [{ transform: ["rotate(0deg)", "rotate(-8deg)", "rotate(6deg)", "rotate(-4deg)", "rotate(2deg)", "rotate(0deg)"] }, { duration: 700, easing: "out" }],
  spin: [{ transform: ["rotate(0deg)", "rotate(360deg)"] }, { duration: 1000, easing: "linear", iterations: Infinity }],
  float: [{ transform: ["translateY(0px)", "translateY(-10px)"] }, { duration: 1600, easing: "in-out", iterations: Infinity, direction: "alternate" }],
} as const;
export type PresetName = keyof typeof PRESETS;

/** Register the built-in keyframes (fadeUp, pop, shake, spin…) so they can be played by name. */
export function installPresets(): Record<PresetName, KeyframesDef> {
  const out = {} as Record<PresetName, KeyframesDef>;
  for (const [name, [frames, defaults]] of Object.entries(PRESETS)) out[name as PresetName] = keyframes(name, frames as never, defaults as never);
  return out;
}
