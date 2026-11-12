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

## Text animations

`hadi-march/motion/text` adds 56 text animations on this engine (one export each, a shared split core of about
1.5 KB gzip). See [src/motion/text/docs.md](../src/motion/text/docs.md).
## One engine for everything (inventory)

Every moving thing in the library and the showcase is under the engine's control, so the global speed, "Stop all",
slow motion and reduced motion reach all of it:

| Kind | Where | How it is controlled |
| --- | --- | --- |
| Engine playbacks (`animate`, `timeline`, springs, tweens, canvas / WebGL) | `src/motion`, `src/fx`, showcase pages | the engine's own clock and WAAPI playbacks |
| CSS `@keyframes` and transitions (spinners, skeleton shimmer, dialog / drawer / toast entry, nav bar, `transition:` classes, charts) | `src/css/tokens.css`, `src/ui/*.css`, `src/dom/lazy.css`, `src/router/router.css`, showcase CSS | `installCssControl()`: `getAnimations()` adopts each one as it starts (pseudo-elements included) |
| Raw WAAPI in components (marquee, the OTP cell pop) | `src/ui/marquee.ts`, `src/forms/inputs.ts` | `animateEl()` (engine/native.ts): global speed at start and on change, paused / resumed with the rest |
| Canvas drawing loops (overlay media) | `src/ui/overlay-media.ts` | `frameLoop()` on the one clock: stops while paused, scaled by the speed |
| Page transitions (View Transitions or fallback), named and modal outlets | `src/motion/page.ts` | engine playbacks; the browser's shared-element morph is retimed and adopted |
| Demo tickers in the showcase | `pages/feedback.tsx` | `onFrame()` instead of `setInterval` |

Not animations (left as they are): popover positioning after mount, scroll restoration after a page swap, polling and
heartbeat timers. `test/motion-rule.test.js` keeps it this way: a new `requestAnimationFrame` loop, raw `el.animate()`
or a `setInterval` that moves something fails the tests.

## Ready-made animations

Each is a separate export of `hadi-march/motion` built on `animate()` / `animateValue()`, so tree shaking keeps only
what a page imports and global speed, "Stop all" and reduced motion reach every one. Showcase: Hareket › SVG,
Morph, Sayfa geçişi efektleri, Mikro etkileşimler, Kaydırma, Listeler.

### SVG (src/motion/svg.ts, path.ts, clip.ts, svg-filter.ts)
- `drawPath(targets, { from, to, stagger })` — `pathLength="1"` and a dash offset (native WAAPI); erase with `from: 1, to: 0`.
- `morphPath(path, d, { points })` — same command lists tween number by number (curves stay curves); otherwise both
  paths are resampled to `points` evenly spaced points and a closed outline is rotated so the points travel least.
- `followPath(el, d, { rotate, angle, trail })` — position (and tangent) per frame; SVG targets get a `transform`
  attribute in user units, HTML targets a CSS transform in px. `trail` draws a stroke up to the element in the same frame.
- `clipReveal(el, { shape, origin, from, count, vertical, hide })` and the pure `clipAt(p, o)` / `clipFrames(o)`; the
  wipe's `start` / `end` follow the text direction.
- `filterBlur`, `displace` (feTurbulence + feDisplacementMap), `goo` (blur + alpha contrast): one `<filter>` per call in a
  hidden `<svg>`, removed when the value settles at 0 (or by the returned cleanup for `goo`).

### Morph (src/motion/morph.ts)
- `morph(from, to, { mode, hideSource, fadeContent })` — container transform: `to` (laid out where it ends) starts
  clipped to `from`'s box (`clip-path: inset(… round r)`) and moved onto it, then opens; background colour and corner
  radius blend; the content fades in, it is never stretched. `mode: "scale"` is a FLIP with a scale (shared element:
  the same picture in two places). Unfilled: nothing stays on the target afterwards.
- `morphBack(from, to)` — the reverse; `to` is shown again when it ends (close / remove `from` after `finished`).
- `morphIcon(path, name)` with `MORPH_ICONS` (play, pause, menu, close, plus, check, minus): every icon is three 4-point
  bars with the same commands, so any two tween number by number.
- `shapeMorph(el, shape)` / `shapePolygon(shape, n)` — radial outlines sampled at the same angles (circle, square,
  triangle, diamond, hexagon, star, blob, flower): clip-path polygons the browser interpolates.

### Page transition variants (src/motion/page-fx.ts)
`definePageTransition(name, (side, dir, rtl, distance) => keyframes)` adds a `meta.transition` name to
`pageTransitions()`. Ready variants, each its own export: `circle` (from the last pressed point), `wipe`, `stack`,
`cube`, `flipPage` ("flip"), `zoomThrough` ("zoom-through"), `curtain`, `blinds`, `pixelDissolve` ("pixel": stepped
clip-path cells, one polygon), `morphPage` ("morph": grows out of the pressed link's box). Register with
`usePageTransitions(circle, cube)`; `PAGE_VARIANTS` lists all. Going back, the old page plays the reverse on top
(`zIndex`); wipe, stack, cube and flip mirror in RTL. With View Transitions the engine animates the pseudo-elements,
otherwise the page elements themselves.
