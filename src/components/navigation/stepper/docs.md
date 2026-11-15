# Stepper

Progress through stages, with motion that shows where you are going. Stepper draws Steps and adds a liquid highlight
that stretches from the old step to the new one and settles there, and step panels that morph into each other: the
old panel blurs and slides toward the past, the new one arrives from the future (mirrored in RTL) while the frame's
height follows. Back / Next buttons and a step counter come with it.

```tsx
<Stepper steps={[{ title: "Cart" }, { title: "Address" }, { title: "Payment" }]} current={$step} onSelect={(i) => $step = i}
  panels={[<Cart />, <Address />, <Payment />]} onFinish={submit} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `steps` | `StepItem[]` | — | `{ title, description?, icon? }` (the Steps items) |
| `current` | number / accessor | — | current step (0-based) |
| `onSelect` | `(i) => void` | — | step clicks and Back / Next |
| `panels` | `unknown[]` or `(i) => unknown` | — | content per step (morph transitions) |
| `nav` | boolean | with panels and onSelect | Back / Next buttons |
| `finishLabel` | string | "Finish" | the last step's button |
| `onFinish` | `() => void` | — | the last step's button |
| `vertical` | boolean / accessor | `false` | steps in a column beside the panel (live; stacked when narrow) |
| `morph` | boolean / accessor | `true` | morph between steps; `false`: the highlight and the panel change at once |
| `m:color` | ColorToken | theme primary | Common prop (march/props): the colour token of the component and everything in it. |
| `highlight` | boolean | `true` | the liquid highlight around the current step |
| `counter` | boolean / `(i, n) => node` | `true` | the "2 / 4" counter between Back and Next, or your own content |
| `labels` | `{ back?, next?, step?: (i, n) => string }` | "Back", "Next", "Step n of m" | button texts and the panel's accessible name (the last button is `finishLabel`) |
| `doneIcon`, `renderDot`, `connector` | as in Steps | — | passed to the Steps inside |
| `class` | ClassProp | — | extra class on the root |

```tsx
<Stepper steps={steps} current={$step} onSelect={(i) => $step = i} panels={panels} highlight={false}
  counter={(i, n) => `${n - i - 1} left`} labels={{ back: "Previous", next: "Continue", step: (i, n) => `Stage ${i + 1} / ${n}` }} />
```

## Accessibility

The steps are the Steps list (`aria-current="step"`, buttons when `onSelect` is set). The panel frame is a polite
live region named "Step n of m"; the leaving panel is hidden from assistive technology while it fades. Back / Next
are buttons that control the panel. Reduced motion: the highlight jumps and panels switch at once.

## Composed of

Steps, Button; the motion engine (highlight stretch, panel morph, height).
