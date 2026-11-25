# Oscilloscope

The shape of a sound, live. A waveform trace over a graticule, triggered where the signal rises through zero so the
picture stands still, with a soft glow and a phosphor afterglow (the last frames fade instead of vanishing). With
`mode="xy"` it draws the left channel against the right: a Lissajous figure (a mono input is paired with itself a
quarter period later, so it still draws a shape). Two looks: a clean `modern` panel in the theme and a retro `crt`
tube with scanlines. It reads any `march/audio` source; with none it shows a quiet flat line.

```tsx
import { audioSource } from "march/audio";
const song = audioSource("demo");                       // start it from a click: song.start()

<Oscilloscope source={song} />
<Oscilloscope source={song} look="crt" persistence={0.8} />
<Oscilloscope source={song} mode="xy" color="brand-purple" height={220} />
<Oscilloscope source={() => $cpu / 100} timebase={10} grid={false} idleText="Waiting…" />
```

## Props

| Prop | |
|---|---|
| `source` | An audio source (`audioSource(…)`), "demo", "mic", an `<audio>` element, a stream or a number 0–1. None: a flat line. |
| `mode` | "wave" (default) or "xy" (left against right). |
| `trigger` | true (default: rising through 0), a level −1…1, or false (free running). |
| `timebase` | Time across the screen in ms. Default 20. |
| `persistence` | Phosphor afterglow 0–0.95. Default 0.55; off with reduced motion or `motion={false}`. |
| `grid` | The graticule: true (10 × 8), false, or `{ x, y }` divisions. |
| `look` | "modern" (default) or "crt". |
| `color` | Trace color token. Default: the accent (phosphor green on "crt"). |
| `lineWidth` / `glow` | Trace width and glow in px. Default 2 and 8 (14 on "crt"); `glow={false}` turns it off. |
| `gain` | Vertical amplification. Default 1. |
| `height` | px or a CSS length. Default 180px. |
| `label` | Accessible name. Default "Oscilloscope". |
| `idleText` | Text while there is no signal. Default "No signal"; false: none. |
| `draw` | Your own layer after each trace: `(ctx, { width, height, samples, color, active }) => …`. |
| `motion` | false or "none": no afterglow. |
| `class` | Extra class on the root. |

Class hooks: `m-osc` (root, `m-osc-modern` / `m-osc-crt`, `is-idle`), `m-osc-grid`, `m-osc-canvas`, `m-osc-idle`.
Theme variables: `--m-osc-line`, `--m-osc-grid-c`, `--m-osc-axis`, `--m-osc-h`.

## Accessibility

- The scope is an image (`role="img"`) named "<label>: <level in words>" (silent, quiet, moderate, loud, very loud);
  the words change at most once a second, so a screen reader is never flooded. With no signal it says "No signal".
- Reduced motion: no afterglow, and the source reads twice a second. Off screen it does not draw at all.
