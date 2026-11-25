# Waveform

The bars of a sound, as in a voice message or a podcast player. The bars come from `peaks` (numbers 0–1, any length),
from `src` (an audio file: fetched and decoded once it is on screen, the peaks computed once per URL), or live from a
`source` (march/audio) as bars rolling in from the inline end. `live` without a source is the decorative motion of a
recording (ChatComposer shows it): no audio, no permission. A playhead (`progress` 0–1, or `currentTime` with
`duration` in seconds) paints the played bars in the progress color; `regions` (chapters) lie as soft bands under the
bars with their labels below; `seekable` turns it into a slider you press, drag or move with the keyboard.

```tsx
<Waveform peaks={voice.peaks} currentTime={$t} duration={voice.seconds} seekable onSeek={(p, s) => ($t = s)} />
<Waveform src="/episodes/42.mp3" progress={$p} regions={chapters} seekable onSeek={seek} onRegionClick={(r) => toast(r.label)} />
<Waveform source={audioSource("mic")} height={32} barWidth={2} gap={2} />
<Waveform live bars={24} height={24} />
```

Static and live bars are drawn on one canvas (march/audio's `audioCanvas`: sized in device pixels, theme colors
re-read on a theme change). The decorative bars are DOM bars moved on the compositor (`play()`), so a recording needs
neither a canvas nor any per-frame script. `decodePeaks(url)` gives the peaks and the duration of a file yourself
(e.g. to store them with a voice message); `resamplePeaks(peaks, n)` fits any peaks to `n` bars.

## Props

| Prop | |
|---|---|
| `peaks` | Bar heights 0–1 (any length, resampled to the bar count). |
| `src` | An audio file URL: fetched and decoded when it comes on screen; its duration is used when `duration` is not given. |
| `source` | Live audio (an AudioSource or an input of march/audio): bars roll in from the inline end. |
| `live` | Live bars; without `source` the decorative recording motion. |
| `progress` | Playhead 0–1. |
| `currentTime` / `duration` | Playhead in seconds and the length in seconds. |
| `regions` | `[{ start, end, label?, color? }]` in seconds (0–1 without a duration): bands under the bars, labels below. |
| `bars` | Number of bars (their width then fills the box). Default: as many as fit (24 for decorative bars). |
| `barWidth` / `gap` | Bar width and space in px. Default 3 and 2. |
| `rounded` | Rounded bar ends. Default true. |
| `align` | "mirror" (centered, default) or "bottom". |
| `height` | Height of the bars in px. Default 48. |
| `color` / `progressColor` | Theme color tokens of the bars and of the played bars + playhead. Default: a quiet gray (live: the accent) and the accent. |
| `playhead` / `regionLabels` | The playhead line and the labels row. Default true. |
| `seekable` | A slider: press, drag (Escape cancels), arrows ±5 %, PageUp/PageDown ±10 %, Home, End. |
| `onSeek` | `(progress, seconds)` after a press, a drag or a key. |
| `onRegionClick` | `(region, index)` when a press without dragging lands in a region. |
| `onLoad` | `({ peaks, duration })` when `src` is decoded. |
| `label` | Accessible name. Default "Waveform" ("Live waveform" with a source). |
| `valueText` | Own spoken position `(seconds, duration) => string`. Default "1:05 of 4:00" plus the region's label. |
| `motion` | Bars grow in when they arrive; decorative bars move. `false`: still. |
| `class` | Extra classes on the root. |

Class hooks: `m-wave`, `m-wave-track`, `m-wave-canvas`, `m-wave-playhead`, `m-wave-regions`, `m-wave-region`,
`m-wave-marks`, `m-wave-mark`, `m-wave-bars`; CSS variables `--m-wave-h`, `--m-wave-bw`, `--m-wave-gap`, `--m-wave-bar`,
`--m-wave-played`; `data-state` is `loading`, `ready`, `error` or `live`.

## Accessibility

- Seekable: `role="slider"` with `aria-valuenow` in whole seconds (percent without a duration) and `aria-valuetext`
  "1:05 of 4:00, Chapter 2", so the spoken value changes at most once a second while it plays. Arrow keys mirror in RTL.
- Not seekable: `role="img"` named "<label>, <duration>". Decorative bars are hidden from screen readers.
- The bars, regions and playhead mirror on right-to-left pages. Reduced motion: no grow-in, the decorative bars stand
  still, a live source updates twice a second.
