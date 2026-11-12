// Timelines: compatibility entry over the motion engine. A timeline is an engine Playback: steps with `at`, labels,
// stagger and callbacks; play / pause / reverse / seek / playbackRate / finished / progress — and it can mix DOM,
// canvas, WebGL and object targets in one time.
//   const tl = timeline({ defaults: { duration: 400, easing: "easeOutExpo" } })
//     .add(".title", [{ opacity: 0, transform: "translateY(20px)" }, { opacity: 1, transform: "none" }])
//     .add(".card", fadeUp, { stagger: 60, at: "-=200" })
//   await tl.play()
export { timeline, type StepOptions, type Target } from "./engine/playback.ts";
import type { Playback } from "./engine/playback.ts";
export type Timeline = Playback;
