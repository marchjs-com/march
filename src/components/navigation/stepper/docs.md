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
| `vertical` | boolean | `false` | vertical steps |
| `color` | ColorToken | theme primary | accent of the steps and the highlight |

## Accessibility

The steps are the Steps list (`aria-current="step"`, buttons when `onSelect` is set). The panel frame is a polite
live region named "Step n of m"; the leaving panel is hidden from assistive technology while it fades. Back / Next
are buttons that control the panel. Reduced motion: the highlight jumps and panels switch at once.

## Composed of

Steps, Button; the motion engine (highlight stretch, panel morph, height).
