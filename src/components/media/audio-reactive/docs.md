# AudioReactive

A wrapper that makes anything move with a sound. On each reading of its `source` (the microphone, an `<audio>`, a
call's stream, the "demo" loop, any number 0–1; see `march/audio`) it writes five CSS variables on itself, each 0–1:
`--m-level`, `--m-bass`, `--m-mid`, `--m-treble` and `--m-peak`. Your CSS reads them, or a ready effect does. The
variables are written in the motion clock's write phase and only while the wrapper is on screen.

```tsx
// an avatar ring that pulses while someone speaks
<AudioReactive source={call} effect="ring" color="brand-green">
  <Avatar name="Ada" />
</AudioReactive>

<AudioReactive source={song} as="section" effect={["pulse", "glow"]} gain={1.5} intensity={0.6}>…</AudioReactive>
<AudioReactive source={mic} vars={{ level: "--talk", peak: false }} sx={{ opacity: "calc(.4 + var(--talk) * .6)" }} />
<AudioReactive source={() => $load / 100} onLevel={(l) => console.log(l.level)} />
```

## Props

| Prop | |
|---|---|
| `source` | What it listens to: an AudioSource or what makes one. |
| `as` | The tag. Default "div". |
| `gain` | Multiplies every reading (then clamped to 1). Default 1. |
| `smoothing` | Extra smoothing of the fall, 0 (default) – 0.99; a rise is at once. |
| `vars` | Which variables: a list (`["level", "bass"]`) or names per reading (`{ level: "--talk", peak: false }`). Default all five. |
| `effect` | "pulse" (scales), "glow" (a soft light), "ring" (a growing ring), "bounce" (jumps on the bass); one or a list. |
| `color` | Theme color token of the glow and the ring. Default the accent. |
| `intensity` | Strength of the effects, 0–2. Default 1. |
| `motion` | `false`: the variables stay 0. |
| `onLevel` | Called after each reading with `{ level, bass, mid, treble, peak }`. |
| `class` / other attributes | On the element (`m-ar`); `role`, `aria-label`, `id`, `data-*` pass through. |

The effects are classes (`m-ar-pulse`, `m-ar-glow`, `m-ar-ring`, `m-ar-bounce`) that read the default names; put one on
any child of the wrapper too. `--m-ar-k` is the strength, `--m-ar-c` the color.

## Accessibility

- It is decoration: the wrapper adds no role. Give it one (and a name) when the motion means something, or say it in
  text nearby ("Ada is speaking").
- Reduced motion: the source reads twice a second; pulse and bounce stop changing size and place, light and color
  still follow. `motion={false}` keeps everything still.

## Composed of

Nothing: it is the shared way to move with sound (the variables) plus four small CSS effects.
