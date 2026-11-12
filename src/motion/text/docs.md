# Text animations (hadi-march/motion/text)

56 text animations, each its own export. Import only what you use; tree shaking leaves the rest out.

```ts
import { rise, wave, typewriter, counter } from "hadi-march/motion/text";

rise(heading);                                  // characters rise from below, then the plain text comes back
wave(badge, { stagger: 80 });                   // a loop: stop() ends it
typewriter(line, { duration: 1500 });           // types with a caret
counter(price, { locale: "tr" });               // counts up to the number in the text: "₺12.500"
const a = rise(title, { by: "word", out: true }); // any entrance plays as an exit with out: true
await a.finished; a.replay(); a.stop(); a.playback.pause();
```

## Shared options

| option | meaning |
| --- | --- |
| `by` | `"char"` (grapheme clusters), `"word"` or `"line"`; each animation has its own default |
| `duration` | ms per part (ticker effects: the whole run) |
| `stagger` | ms between parts (char 30, word 90, line 160 by default) |
| `easing` | any engine easing: `"out"`, `"expo"`, `"back"`, `"spring-wobbly"`, `"bounce"`, `"steps(5, end)"`, CSS curves |
| `delay`, `from` | start delay; stagger origin `"start" | "end" | "center" | "edges" | "random"` |
| `out` | play backwards as an exit; the parts stay hidden until `stop()` |
| `iterations` | repeat count (`Infinity` loops) |
| `keep` | keep the split parts at the end (entrances put the plain text back by default) |

Extra options: `highlight / underline / strike / gradientSweep / strokeDraw` take `color`; `typewriter` takes `caret`;
`typeLoop / wordCycle / morph` take `words` (default: the text split at `|`) and `hold`; `scramble / decode / matrix /
splitFlap` take `chars`; `counter` takes `start`, `end`, `decimals`, `locale`; `magnetic / repel` take `radius` and
`strength`.

## Families

- **Entrances / exits** — fade, dissolve, blurIn, rise, drop, slideIn, pop, zoomIn, flip, rotateIn, swing, elastic,
  bounceIn, tilt, perspective, skewIn, splitReveal, maskReveal, wipe, cascade, spin, jelly, trackIn, implode, explode
  (an exit), inkBleed, pixelate, glitch, shake.
- **Loops** — wave, bounce, jitter, float, pulse, rainbow, neon, breathe, glow, shimmer.
- **Decorations** — highlight, underline, strike, gradientSweep, strokeDraw (SVG outline, then fill).
- **Content** — typewriter, typeLoop, scramble, decode, matrix, splitFlap, counter, odometer, wordCycle, morph.
- **Interactive** — magnetic, repel.

The catalog with each animation's family and the shared options it reads is `TEXT_ANIMATIONS` in
`hadi-march/motion/text/meta` (a test keeps it equal to the exports).

## The core: splitText()

`splitText(el, by)` is the one piece every animation shares (also exported for your own effects):

- a visually hidden copy of the text stays in the element and the moving parts sit in an `aria-hidden` wrapper, so a
  screen reader reads "Merhaba", never "M e r h a b a"; content effects (typewriter, counter, scramble) keep the real
  text in that copy the whole time;
- characters are grapheme clusters (`Intl.Segmenter`): `İ`, `ğ`, flags and family emoji stay whole;
- scripts whose letters join (Arabic, Syriac, N'Ko, Mongolian, Indic) split by word instead, so shaping never breaks;
- RTL: parts follow the text direction; `slideIn`, `skewIn`, `tilt`, `wipe` and the marks mirror themselves;
- nested markup (`<b>`, `<a>`) is kept for char / word splits; `revert()` puts the original nodes back (listeners kept);
- styles go through CSSOM only (CSP safe, no style attribute strings, no CSS file to load); every part has `--i`.

Starting a new text animation on an element stops the one running there first.

## Engine and reduced motion

Every animation is one timeline on the motion engine: global speed, "pause all", slow motion and off-screen pausing apply.
Per-part transforms run on the compositor (WAAPI); content effects run as one value on the engine clock. With reduced
motion an animation shows its end state at once and loops stay still. Interactive ones do nothing.

## Cost

`node --import ./compiler/register.js bench/text-size.js` prints the gzip cost of each animation on top of the engine:
the shared core is about 1.5 KB, each animation adds 25–520 B. `test/motion-text.test.js` keeps one import under
2.25 KB + 0.9 KB and each further animation under 0.9 KB. Nothing here is in a page's start-up code unless that page
imports it; the showcase page loads it as its own route chunk.
