# LevelMeter

A studio LED meter: a column (or row) of segments that light green, amber and red as the level rises, a peak light
that holds for a moment and then falls, and a clip light that stays on after the signal hit the top until you press
it. Feed it a number (`value`, 0–1 or `min`…`max`, one per channel for stereo) or a live sound (`source`: the
microphone, an `<audio>`, a call's stream, the "demo" loop or any number accessor; see `march/audio`). The segments
are built once: a reading writes one CSS variable and moves one class, so a meter at 60 frames a second creates no
nodes, and it reads only while it is on screen.

```tsx
<LevelMeter value={$cpu} />
<LevelMeter source={mic} scale="db" ticks />                       // stereo from the source's left / right
<LevelMeter value={[$left, $right]} orientation="horizontal" segments={32} peakHold={2000} />
<LevelMeter value={$load} min={0} max={100} zones={[0.6, 0.85]} colors={["info", "brand-gold", "danger"]} clip={false} />
```

```tsx
const mic = audioSource("mic");
<Button on:click={() => mic.start()}>Mikrofonu aç</Button>
<LevelMeter source={mic} channels={1} scale="db" floor={-60} ticks onClip={() => toast("Çok yüksek")} />
```

## Props

| Prop | |
|---|---|
| `value` | A number or `[left, right]` from `min` to `max` (default 0–1). May be live. |
| `source` | A live sound instead: an AudioSource or what makes one ("mic", "demo", an element, a stream, a number accessor). |
| `channels` | 1 or 2. Default 2 with a `source` or a two-number value, else 1. |
| `min` / `max` | The range of `value`. Default 0 and 1. |
| `orientation` | "vertical" (default, fills upward) or "horizontal" (fills from the inline start, mirrored right to left). |
| `segments` | Number of LEDs. Default 24. |
| `zones` | Where amber and red start, as fractions of the meter. Default `[0.7, 0.9]`. |
| `colors` | Three theme color tokens for the zones. Default `["success", "warn", "danger"]`. |
| `scale` | "linear" (default) or "db" (decibels from `floor` to 0 dBFS). |
| `floor` | The bottom of the dB scale. Default -48. |
| `ticks` / `tickFormat` | A scale beside the bars: `true` (default marks) or your marks (dB on "db", else min…max); the text of a mark. |
| `peakHold` | How long the peak light holds (ms) before it falls; `false` for none. Default 1500. |
| `clip` | The latched clip light: `true` (at 0.99 of the range), a threshold 0–1, or `false`. Default true. |
| `onClip` / `onClipReset` | A channel clipped (0 = left / mono, 1 = right) / the light was pressed. |
| `labels` | Channel letters: `true` (L / R in stereo), your texts or `false`. |
| `label` / `channelNames` / `clipLabel` | Accessible name ("Level"), spoken channel names (["left", "right"]), the clip button's name ("Reset clip"). |
| `format` | The spoken value `(level, channel) => string`. Default "-12 dB" or a percent. |
| `variant` | "console" (default: a dark housing with glowing LEDs in every theme) or "flat" (the page's surfaces). |
| `size` / `length` / `gap` | Bar thickness (sm, md, lg), bar length (px or CSS), gap between LEDs (px). |
| `motion` | `false`: the peak jumps instead of falling and the LEDs switch off at once (as with reduced motion). |
| `class` | On the root (`m-lm`). Parts: `m-lm-ch`, `m-lm-meter`, `m-lm-bar`, `m-lm-seg` (`is-low`, `is-mid`, `is-high`, `is-peak`), `m-lm-clip`, `m-lm-label`, `m-lm-scale`, `m-lm-tick`. |

CSS variables on the root: `--m-lm-c1…c3` (zone colors), `--m-lm-t` (thickness), `--m-lm-len`, `--m-lm-gap`,
`--m-lm-release` (how long a LED takes to go dark, 180 ms), `--m-lm-glow`, `--m-lm-well` / `--m-lm-track` (housing).

## Accessibility

- Each channel is a `meter` (0–100) named "Level" ("Level, left" / "Level, right" in stereo) with a spoken value
  ("-12 dB" or "45%"); the value is updated at most four times a second, the last reading always lands.
- The LEDs, letters and scale are hidden from screen readers (the meter says the same).
- The clip light is an IconButton (`aria-pressed` while lit): Enter or Space resets it.
- Reduced motion: a live source reads twice a second, the peak does not fall gradually, the LEDs do not fade.

## Composed of

IconButton (the clip light's press target) holding a StatusDot (the light).
