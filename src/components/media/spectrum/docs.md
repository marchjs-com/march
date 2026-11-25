# Spectrum

The frequencies of a sound, live: bass on one side, treble on the other. Bars on a log-frequency scale (`minHz` to
`maxHz`, as the ear hears, so low notes get as much room as high ones) with peak caps that fall slowly. Four looks:
`bars`, `mirror` (around the middle line), `circle` (around a ring) and `line` (a curve with a soft fill). One theme
color, the four HADİ colors (`colors="brand"`) or your own list of tokens, as a gradient or hard segments. It reads any
`march/audio` source; with none it shows empty bars.

```tsx
import { audioSource } from "march/audio";
const song = audioSource("demo");                       // start it from a click: song.start()

<Spectrum source={song} />
<Spectrum source={song} variant="mirror" colors="brand" bars={64} gap={1} />
<Spectrum source={song} variant="circle" colors={["brand-blue", "brand-pink"]} height={260} />
<Spectrum source={song} variant="line" color="success" minHz={60} maxHz={8000} peaks={false} />
```

## Props

| Prop | |
|---|---|
| `source` | An audio source (`audioSource(…)`), "demo", "mic", an `<audio>` element, a stream or a number 0–1. None: empty bars. |
| `variant` | "bars" (default), "mirror", "circle" or "line". |
| `bars` | Number of bars. Default 48. |
| `scale` | "log" (default) or "linear". |
| `minHz` / `maxHz` | The frequency range. Default 30 and 16000. |
| `peaks` / `peakFall` | Falling peak caps (default on) and their speed in heights per second (default 0.5). |
| `gap` / `radius` | Space between bars and their corner radius in px. Default 2 and 2. |
| `gain` | Amplification. Default 1. |
| `color` | One color token. Default: the accent. |
| `colors` / `paint` | Several colors low to high: "brand" or a token list; "gradient" (default) or "segments". |
| `height` | px or a CSS length. Default 160px (240px for "circle"). |
| `label` | Accessible name. Default "Spectrum". |
| `idleText` | Text while there is no signal. Default "No signal"; false: none. |
| `draw` | Your own layer after each frame: `(ctx, { width, height, values, peaks, edges, color, active }) => …`. |
| `motion` | false or "none": no falling caps. |
| `class` | Extra class on the root. |

Class hooks: `m-spec` (root, `m-spec-bars|mirror|circle|line`, `is-idle`), `m-spec-canvas`, `m-spec-idle`. Theme
variables: `--m-spec-bar`, `--m-spec-peak`, `--m-spec-idle`, `--m-spec-h`.

## Accessibility

- The spectrum is an image (`role="img"`) named "<label>: <level in words>, loudest near <frequency>" (for example
  "Spectrum: loud, loudest near 220 Hz"); it changes at most once a second. With no signal it says "No signal".
- Quiet bars are drawn dimmer as well as shorter, so the shape does not depend on color alone.
- Reduced motion: no falling caps, and the source reads twice a second. Off screen it does not draw at all.
