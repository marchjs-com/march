# Motion engine (hadi-march/motion)

One keyframe-based engine for every animation: DOM, CSS variables, canvas, WebGL and plain values play on the same
playback model and the same clock, under one global control. Source: `src/motion/engine/`. The older API (`animate`,
`timeline`, `stagger`, `tween`, `spring`, `flip`, `transition:`, gestures, scroll) is a thin layer over it.

## Layers

| Layer | File | What it does |
|---|---|---|
| Value | `tracks.ts`, `color.ts`, `ease.ts`, `keyframes.ts` | Keyframes → per-property tracks in `Float64Array`s. Numbers, vectors, colors (OKLab, premultiplied alpha), strings with numbers (`translate(…) rotate(…)`), discrete values. Named easings, cubic-bezier, steps, spring / bounce (→ CSS `linear()`). Named keyframes and presets. |
| Playback | `playback.ts` | `animate()` and `timeline()` return a `Playback`: play, pause, reverse, seek (ms or label), finish, cancel, `playbackRate`, `currentTime`, `duration`, `finished`, `progress()`, `onUpdate`, `call()`. Timelines: `at` (ms, `+=`, `-=`, `<`, `>`, `label`, `label+=n`), labels, stagger, nested timelines. |
| Drivers | `drivers.ts`, `canvas.ts` | `dom` (WAAPI first, CSSOM fallback, will-change in and out), `cssVar` (@property), `object`, `canvas2d`, `webgl` (uniforms), `defineDriver()`. |
| Clock | `clock.ts`, `visibility.ts` | One rAF loop with read → update → write → render phases; time scaled by the global speed, frozen while paused; sleeps when idle; off-screen targets are not written, endless native animations pause off screen. `measure()`, `mutate()`, `yieldToMain()`. |
| Control | `config.ts`, `prefs.ts`, `motion.ts`, `css-control.ts`, `monitor.ts` | `motion.config({ speed, reduce, duration, easing, slowMo, character })` (saved), `pauseAll` / `resumeAll`, CSS animation control, `frameMonitor()`, `viewTransition()`, `defineMotion()`. |

## How a playback runs

Each effect (one target × its tracks × timing) picks its path once:

- **native** — the driver can start a WAAPI animation and every value and easing has a CSS form: the effect runs on the
  compositor. The playback only sets its `currentTime`, `playbackRate` and play state; the effect's position in the
  timeline is its WAAPI `delay`, so every native effect of a timeline shares one time.
- **JS** — sampled on the clock (objects, canvas, WebGL, vectors, custom JS easings, no WAAPI). Sampling writes into
  preallocated buffers; canvas / WebGL targets are drawn once per frame in the render phase, after every write.

Global speed multiplies native rates and clock time alike, so mixed timelines stay in step; pause stops both (and plain
CSS animations, found with `getAnimations()`).

## Reduced motion

`reduce: "system"` follows `prefers-reduced-motion`; `"reduce"` / `"full"` override it. While reduced, non-`essential`
playbacks jump to their end, endless ones stay still, finite CSS animations finish at once, and `<html data-hm-reduced>`
lets CSS (motion.css, generated keyframes) follow the user setting too.

## CSS output

`keyframesCss({ names })` (or `node tools/gen-motion-css.js <module> out.css --presets`) writes `@keyframes hm-<name>` and
`.hm-anim-<name>` classes from the registrations: springs as `linear()` with a cubic-bezier before it for older browsers,
and reduced-motion rules.

## Performance

- Compositor-only properties on the DOM path (dev warning otherwise); `will-change` only while animating.
- No allocation per frame for JS targets (typed arrays, cached segment index); one clock callback per root playback.
- `test/motion-engine.test.js` measures a 200-item stagger (start < 50 ms, JS frame for 200 targets < 8 ms);
  `tools/motion-audit.mjs` checks the showcase in headless Edge (Stop all, global speed, 200-item stagger without long tasks).
