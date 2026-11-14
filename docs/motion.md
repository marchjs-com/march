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
playbacks jump to their end, endless ones stay still, finite CSS animations finish at once, and `<html data-m-reduced>`
lets CSS (motion.css, generated keyframes) follow the user setting too.

## CSS output

`keyframesCss({ names })` (or `node tools/gen-motion-css.js <module> out.css --presets`) writes `@keyframes m-<name>` and
`.m-anim-<name>` classes from the registrations: springs as `linear()` with a cubic-bezier before it for older browsers,
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
| Raw WAAPI in components (marquee, the OTP cell pop) | `src/components/typography/overflow-text/index.ts`, `src/forms/inputs.ts` | `animateEl()` (engine/native.ts): global speed at start and on change, paused / resumed with the rest |
| Canvas drawing loops (overlay media) | `src/components/media/overlay/media.ts` | `frameLoop()` on the one clock: stops while paused, scaled by the speed |
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

### Page-wide (src/motion/theme-wave.ts, spotlight.ts)
- `themeWave(change, { origin, duration, easing })` runs a page-wide restyle as a circle of the new look that grows
  from `origin` (a viewport point or an element): a View Transition whose new snapshot is clipped by an engine
  animation (`:root[data-m-wave]` turns the browser's cross-fade off, motion.css). Without View Transitions, with
  reduced motion or while paused the change lands at once. Painted shapes (`shape: "drip" | "spray" | "sweep" | "splat"`, src/motion/theme-paint.ts: a lazy part,
  loaded the first time one runs; `installThemeWave` with a painted shape loads it ahead) bring the new look in with no
  snapshot and no waiting: the page takes the new look at once and stays live and usable (every press and key reaches
  it, its animations run on); above it a passive veil (`.m-wave-veil`: no pointer, inert, hidden from assistive tech)
  holds a live copy of the page in the old look (the root's custom properties as they were; cut to what is near the
  screen; no ids, frames or media; kept in step with the page while it is up: text, attributes, inline styles, nodes,
  field values, scroll places, canvas pictures every frame, every running animation and transition at the page's own
  time), and paint eats the veil away. The paint is mask layers subtracted from a full layer, whose sizes and places
  tween between keyframes (`paintLayers`, `paintFrames`, `paintMask`; default 1600 ms):
  - `drip`: paint gathers along the top and runs down in streams (soft-sided bands led by a round drop, thicker near
    the top), each at its own speed, thickening into each other until nothing is bare. The showcase uses it.
  - `spray`: one nozzle from a random place paints a dense core and a mist of drops, in strokes of changing
    direction, each heading for a bare part.
  - `sweep`: the nozzle sweeps its row from a random place, then the rows below and above in turn.
  - `splat`: patches burst out from the pressed point, specks flying ahead.
- `installThemeWave()` puts it around every `setTheme` / `setColorTheme` / `setAccent` (through `setRestyleTransition`
  of hadi-march/ui), so ThemeMenu, ThemePicker, ThemeToggle and AccentPicker all spread from the pressed point (the
  focused control for a key press). It returns the function that turns it off.
- `spotlight(root, { selector, reach, look, litClass, xVar, yVar })` lights every card near the pointer from the real
  pointer position (`--m-spot-x` / `--m-spot-y` inside each card, class `is-lit`), also from the gap between two cards,
  so the light reads as one. One pass per frame on the engine clock; touch pointers are ignored. The ready look is
  `.m-spotlight` (motion.css: a soft glow and a brighter ring; `--m-spot-color`, `--m-spot-glow`).

### Morph (src/motion/morph.ts)
- `morph(from, to, { mode, hideSource, fadeContent })` — container transform: `to` (laid out where it ends) starts
  clipped to `from`'s box (`clip-path: inset(… round r)`) and moved onto it, then opens; background colour and corner
  radius blend; the content fades in, it is never stretched. `mode: "scale"` is a FLIP with a scale (shared element:
  the same picture in two places). Unfilled: nothing stays on the target afterwards.
- `morphBack(from, to)` — the reverse; `to` is shown again when it ends (close / remove `from` after `finished`). Right after, every effect and inline style comes off `from`, so it opens clean next time. A newer morph on any of the same elements cancels the running one (its effects removed, a source it hid shown again; `finished` resolves with `state` `"idle"`), so overlapping clicks never stack effects. `morphIcon` and `shapeMorph` likewise replace a running morph on the same element.
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
otherwise the page elements themselves. The snapshot layers are clipped to the box of the part that changes, so a scaled, blurred
or turning page never covers the menu. Mark an element inside the page with `data-m-transition` (a demo stage, a content
column) and only that part animates; the rest of the page swaps at once. "Stop all" during a variant transition ends
it at once (its layer animations are removed), and a newer navigation replaces a running one, so no layer stays.

### Micro-interactions (src/motion/micro.ts; magnet, tilt, press in gestures.ts)
- `use:ripple={{ duration, opacity, center }}` — ink from the press point (Enter / Space: the centre), `currentColor`.
- `use:hoverParallax={{ depth, tilt, selector }}` — children with `data-depth` shift with the pointer, the container may
  tilt; leaving springs them back (`spring-wobbly`). `hold: true` keeps the pose when the pointer leaves and eases to
  wherever it comes back in (no reset, no jump); `layerTilt` (degrees) also turns every layer about its own centre
  (give the container a CSS `perspective`); `glare: true` writes the pointer's place inside each layer to
  `--m-glare-x` / `--m-glare-y` for a glare drawn in CSS (glass cards). A negative `depth` moves layers away from the pointer.
- `use:press={{ scale, easing }}` — the release can be a spring (`"spring-wobbly"` brings its own duration).
- `stateMorph(button, "loading" | "success" | "error" | "idle", { confetti, labels })` — narrows to a circle with a
  spinner, draws a check or a cross (error shakes), colours from the tokens via `data-m-state` (motion.css), announces
  the state in a polite live region, `aria-busy` while loading; `confetti: true` loads hadi-march/fx on demand.

### Scroll (src/motion/scroll-fx.ts)
A paused Playback is seeked by scroll progress (read phase, once per frame), so keyframes, timelines and easings are the
same as for time. `source` is a scroll box (default the page), `track` the element whose passage counts, `range` a
window of it. `scrollTimeline(target, frames | null, o)`, `parallaxLayers(container, { strength })` (`data-depth`,
still with reduced motion), `stickyReveal(section, { steps, onStep })` (sets `--m-scroll`), `scrollIndicator(bar)`
(grows from the inline start, RTL mirrored, essential), `scrollFraction(o)`, `onScrollProgress(o, fn)`. "Pause all"
freezes them.

### Lists (src/motion/list.ts)
- `animateList(container, { enter, exit, move, duration, stagger })` — watches the children (any renderer): added ones
  enter, removed ones leave as an inert ghost copy where they were, moved ones glide (FLIP from layout offsets; one
  caught mid-flight starts where it is on screen).
- `staggerIn(targets, { preset, each, from, grid })`, `listFrames(preset, "in" | "out", rtl)` with the presets fade,
  scale, rise, slide (RTL mirrored), pop (spring), flip.
