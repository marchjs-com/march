# LoudnessGraph

The history graph of a broadcast or streaming loudness meter. It reads a live sound's loudness with march/audio's
`loudness()` (momentary and short-term loudness in LUFS with the K-weighting of ITU-R BS.1770, the gated integrated
loudness and the stereo correlation) or readings you feed it, records them a few times a second, and draws the last
seconds on the chart family's LineChart with target lines (−14 LUFS for streaming services, −23 LUFS for broadcast,
EBU R128), a second LineChart for the correlation (−1 out of phase … 0 wide … +1 mono), and readouts that tween to each
new reading on the motion engine. It samples only while it is on screen and not `paused`.

```tsx
const song = audioSource(audioEl)
<LoudnessGraph source={song} />
<LoudnessGraph source={mic} show={["shortTerm", "integrated"]} targets={[{ value: -16, label: "Podcast" }]} span={60} />
<LoudnessGraph value={$serverMeter} rate={4} parts={{ correlation: false }} />      // readings from elsewhere
<LoudnessGraph source={song} range={[-36, -6]} colors={{ momentary: "brand-blue", shortTerm: "brand-pink" }} />
```

The readings alone, without the graph (march/audio):

```ts
import { audioSource, loudness } from "march/audio"
const src = audioSource(audioEl), lu = loudness(src)
src.use(el)                 // readings flow while el is on screen
lu.momentary(); lu.shortTerm(); lu.integrated(); lu.correlation(); lu.reset()
```

## Props

| Prop | |
|---|---|
| `source` | A live sound: an AudioSource or what makes one ("mic", "demo", an `<audio>`, a stream, a number accessor). |
| `value` | Readings instead: `{ momentary, shortTerm, integrated, correlation }` (it may be live); a missing one is a gap. |
| `span` / `rate` | Seconds of history (30) and readings recorded per second (10). |
| `show` | Loudness lines: `"momentary"`, `"shortTerm"`, `"integrated"`. Default the first two. |
| `targets` | Target lines `[{ value, label?, color? }]` in LUFS; `false`: none. Default −14 and −23. |
| `range` | The LUFS axis `[low, high]`. Default `[-40, 0]`. |
| `height` | Height of the loudness graph in px (200); the correlation graph is 80. |
| `colors` | Theme color tokens per line: `{ momentary, shortTerm, integrated, correlation }`. |
| `labels` / `label` | Texts of the readings ("Momentary", "Short-term", "Integrated", "Correlation"); the name of the whole meter ("Loudness"). |
| `format` | Text of a LUFS value. Default: one decimal in the page's language, "–∞" for silence. |
| `paused` | Stop recording (the graph stands, the readouts still follow). |
| `duration` | Length of a readout's tween to a new reading (180 ms). |
| `motion` | `false` (or `"none"`): the readouts jump. Reduced motion does the same. |
| `parts` | `{ readouts, loudness, correlation, targets, legend }` on or off. |
| `onSample` | Called with each recorded reading. |
| `class` | Extra class on the root. |

Class hooks: `m-lg` (root; `is-paused`), `m-lg-readouts`, `m-lg-readout` (`is-momentary`, `is-shortTerm`,
`is-integrated`, `is-correlation`), `m-lg-name`, `m-lg-value`, `m-lg-unit`, `m-lg-corr`, `m-lg-corr-dot`, `m-lg-chart`
(`is-loudness`, `is-correlation`; the LineChart's `m-chart-*` hooks inside; a target line is
`[data-series^="target"]`). CSS variables: `--m-lg-gap`, `--m-lg-c` (a readout's colour), `--m-lg-pos` (the
correlation marker, 0–1).

How exact is it? Each reading K-weights the waveform window the source reads per frame (2048 samples by default) and
averages those windows over 400 ms (momentary) or 3 s (short-term); the integrated value gates 400 ms blocks at −70
LUFS and 10 LU below their mean. On steady material it is within a few tenths of a dB of a sample-exact meter: enough to
aim at a target, not a certificate for delivery.

## Accessibility

- The whole meter is a `group` named "Loudness". Each readout is a `meter` ("Momentary": "-14.2 LUFS"; "Correlation":
  0.8) whose value is spoken at most four times a second.
- The graphs are LineCharts: an image with a title, keyboard points (arrow keys) with a tooltip, and a hidden data
  table of the history.
- The correlation bar reads −1 → +1 left to right in every language (as a phase meter does).
- Reduced motion: a live source reads twice a second and the readouts jump.

## Composed of

LineChart (the loudness history with the target lines; the correlation history).
