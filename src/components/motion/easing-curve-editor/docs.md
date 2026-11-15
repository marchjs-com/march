# EasingCurveEditor

Edit a `cubic-bezier()` easing by its two handles and watch it run. The preview runs on the motion engine's clock, so
the global speed, "Stop all" and reduced motion apply to it; a faint dot moves linearly beside the eased one, and a
marker rides the curve. The presets are the engine's named curves. With `name`, every change registers the curve in
the engine (`defineEasing`), so any animation can use it by name.

```tsx
<EasingCurveEditor bind:value={$easing} name="hadi-pop" />
animate(card, frames, { duration: 600, easing: "hadi-pop" })
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | string | `cubic-bezier(.34, 1.56, .64, 1)` | a `cubic-bezier()` or an engine curve name (`out`, `expo`, `back` …) |
| `name` | string | — | register the curve in the motion engine under this name |
| `presets` | `EasingPreset[]` or `false` | engine curves | `{ name, label?, value: [x1, y1, x2, y2] }` |
| `preview` | `move` `scale` `fade` `none` | `move` | |
| `compact` | boolean | `false` | small curve beside the numbers, presets in one scrolling row, no CSS line (an inspector: KeyframeTimeline) |
| `duration` | ms | `900` | preview duration |
| `readonly`, `disabled` | | | |
| `labels` | `{ firstHandle, secondHandle, presets, curve(css), handleValue(time, progress), controlPoint(axis), registered(name) }` | built-in texts | your own words; any subset |
| `inputs` | boolean | `true` | the four number fields |
| `cssLine` | boolean | `true` | the line with the CSS value |
| `nameNote` | boolean | `true` | the "Registered as …" note shown with `name` |
| `grid` | boolean | `true` | the quarter lines of the plot |
| `handleColors` | `[ColorToken, ColorToken]` | `brand-orange`, `brand-blue` | colors of the two handles |
| `color` | ColorToken | accent | curve glow, preview dot, marker, picked preset |
| `aria-label` | string | "Easing curve editor" | accessible name of the editor |
| `class` | string | — | on the root (`m-ec`; parts: `m-ec-plot`, `m-ec-handle`, `m-ec-stage`, `m-ec-inputs`, `m-ec-css`, `m-ec-name`, `m-ec-presets`) |

Only the curve, in your own colors and words:

```tsx
<EasingCurveEditor bind:value={$easing} inputs={false} cssLine={false} presets={false} preview="none" grid={false}
  handleColors={["brand-purple", "brand-green"]} color="brand-purple" labels={{ firstHandle: "Start", secondHandle: "End" }} />
```

Helpers: `bezierCss`, `parseBezier`, `EASING_PRESETS`. The x of a handle stays within 0–1 (time); y may overshoot
(−0.6–1.6) for anticipation and bounce. Shift while dragging snaps y to 0.05.

## Accessibility

Each handle is a focusable `role="slider"` whose value text names its time and progress; arrows move it by 0.01
(Shift: 0.1). The four numbers are labelled fields. The preview is decorative (`aria-hidden`); the curve has its CSS
as a label. Time runs left to right in every writing direction.

## Composed of

Card (the frame), Field with NumberInput (the four numbers), Button (presets). Built on the motion engine (`ease`,
`defineEasing`, `onFrame`) and the drag behavior (`march/behaviors/drag`).
