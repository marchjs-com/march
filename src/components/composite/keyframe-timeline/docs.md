# KeyframeTimeline

Edit and play a keyframe animation on the motion engine. Each track animates one property (x, y, scale, rotate,
opacity) of a target; its lane shows the value curve and the keyframes as diamonds you drag along time (snapped,
Alt for free). Scrub the ruler or drag the playhead; play, pause, loop and change the speed. The selected keyframe has
its time, value and an EasingCurveEditor for the curve into it. Playback is a motion engine `Playback`, so the global
speed, "Stop all" and reduced motion apply; `timelineCode(model)` writes the same animation as engine timeline code.

```tsx
<KeyframeTimeline bind:value={$scene} />
<KeyframeTimeline value={model} snap={100} loop={false} renderTarget={(name) => <img src={`/${name}.svg`} alt="" />} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | `TimelineModel` | — | `{ duration, tracks: [{ id, target, prop, color?, keys: [{ at, value, easing? }] }] }` |
| `snap` | ms | `50` | keyframe and scrub step; `0` off |
| `loop` | boolean | `true` | |
| `autoplay` | boolean | `false` | |
| `stage` | boolean | `true` | preview of the targets over the lanes |
| `renderTarget` | `(name) => Element` | labelled pill | the preview element of a target (moved with CSS variables) |
| `transport` | boolean / `("play" \| "start" \| "loop" \| "time" \| "speed")[]` | `true` | the playback bar, or only the listed parts (Space still plays) |
| `speeds` | number[] | `[0.25, 0.5, 1, 2]` | speed choices |
| `inspector` | boolean | `true` | time, value, delete and easing of the selected keyframe |
| `hint` | boolean | `true` | the text in the inspector's place while nothing is selected |
| `curves` | boolean | `true` | the value curve drawn in every lane |
| `labels` | object | — | own texts: `timeline`, `playback`, `play`, `pause`, `start`, `loop`, `speed`, `playhead`, `hint`, `time`, `value`, `remove`, `easing`, `keyframe(number, target, prop)`, `lane(target, prop)` |
| `readonly`, `disabled` | | | |
| `class` | class value | — | on the root (`hm-kt`) |

```tsx
<KeyframeTimeline bind:value={$timeline} transport={["play", "time"]} curves={false} hint={false}
  labels={{ play: "Start", time: "At (ms)", keyframe: (n, target, prop) => `${target} ${prop}, key ${n}` }} />
<KeyframeTimeline value={$timeline} transport={false} inspector={false} stage={false} readonly />   // lanes only
```

Helpers: `sample(model, t)`, `sampleTrack(track, t)`, `targetVars(values)`, `timelineCode(model)`.

## Accessibility

The transport is a toolbar (Play / Pause with Space, back to start, loop with `aria-pressed`, speed as a radio group).
The playhead is a `slider` with the time in words: arrows step one frame (Shift: 10 frames), Home / End. Every keyframe
is a `slider` named after its target and property: ← → move it by the snap step (Shift: ×10), Enter moves the
playhead to it, Delete removes it (a track keeps its last keyframe). Lanes say how to add a keyframe. Time runs left to
right in every writing direction, as in any timeline.

## Composed of

EasingCurveEditor (the selected keyframe's easing), IconButton and Segmented (transport); the motion engine's timeline,
easings and clock; the drag behavior (`hadi-march/behaviors/drag`).
