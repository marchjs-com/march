# TimeRuler

The ruler above a timeline: ticks, time labels and a playhead. Read-only it shows where a run or an animation is.
With `onSeek` the ruler is draggable (a press anywhere jumps there) and the playhead becomes a slider. Rows under the
ruler use the same scale with `timePercent(ms, duration)`.

```tsx
<TimeRuler duration={2000} value={$now} onSeek={(ms) => playback.seek(ms)} onSeekStart={pause} />
<TimeRuler duration={() => span()} value={() => runner.elapsed()} minor={false} color="brand-orange" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `duration` | `number` / accessor (ms) | | time across the ruler |
| `value` | `number` / accessor (ms) | | playhead; `null`: none |
| `onSeek` | `(ms) => void` | | makes the ruler draggable and the playhead a slider |
| `onSeekStart` | `() => void` | | a drag or a key press starts (pause here) |
| `step` | `number` / accessor (ms) | picked for the duration | minor tick distance |
| `major` | `number` / accessor (ms) | picked for the duration | labelled tick distance |
| `minor` | `boolean` | `true` | ticks between the labels |
| `ticks` | `(duration) => { at, major?, label? }[]` | | own ticks |
| `format` | `(ms) => node` | `"1.5s"` | label of a major tick |
| `valueText` | `(ms) => string` | `"1.50 s"` | spoken value of the playhead |
| `snap` | `(ms, pointerEvent) => ms` | | round a dragged time |
| `keyStep` | `number` (ms) | `100` | one arrow key press (Shift: ten times) |
| `head` | `boolean` / node | `true` | the playhead, or your own grip |
| `headClass` | `string` | | extra class of the playhead |
| `color` | color token | accent | colour of the playhead |
| `labels` | `{ ruler?, playhead? }` | "Time ruler", "Playhead" (translated) | |
| `class` | class value | | |

`timeTicks(duration, { step?, major?, minor? })` returns the computed ticks; `timePercent(ms, duration)` a CSS
percentage on the same scale. The CSS variable `--hm-time-ruler-reach` makes the playhead line run below the ruler,
over the rows of a timeline.

## Accessibility

Read-only the ruler is decoration (`aria-hidden`): announce the time where it is written. Seekable: a `group` named
"Time ruler" whose playhead is a `slider` (value in ms, spoken through `valueText`); Left / Right move it by `keyStep`
(mirrored in right-to-left text, ten times with Shift), Home and End jump to the ends. The grip shows a focus ring;
reduced motion: no grip animation.

## Composed of

The drag behavior (`track`, `arrowStep`).
