# GradientEditor

Build a CSS gradient by hand. Pick the type (linear, radial, conic), turn the angle dial or press a quick angle, click
the stop bar to add a color stop (its color is the gradient's color at that point), drag stops to move them, drag one
down (or press Delete) to remove it, and edit the selected stop's color with a full ColorPicker. Presets start from
the HADİ colors and the theme palette; the CSS is ready to copy.

```tsx
<GradientEditor bind:value={$background} />
<GradientEditor value="radial-gradient(circle, #ffd27a 0%, #f2801f 100%)" types={["radial"]} presets={false} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | CSS gradient | HADİ orange → purple | linear-, radial-, conic-gradient (hand-written ones parse too: `to right`, unpositioned stops, `turn`) |
| `types` | `GradientType[]` | all three | types offered |
| `presets` | `GradientPreset[]` or `false` | HADİ + theme | `{ label, value }`: a CSS gradient or a list of colors / tokens |
| `output` | boolean | `true` | CSS with a copy button |
| `preview` | boolean | `true` | the large preview on top |
| `dial` | boolean | `true` | the angle dial |
| `angles` | number[] or `false` | 0 … 315 by 45 | quick angle buttons |
| `hint` | boolean | `true` | the hint under the stop bar |
| `position` | boolean | `true` | the position field of the selected stop |
| `labels` | object | — | own texts: `editor`, `preview(css)`, `type`, `linear`, `radial`, `conic`, `angle`, `degrees(n)`, `quickAngles`, `stops`, `stop(number, color)`, `hint`, `position`, `presets`, `preset(name)`, `copy`, `copied` |
| `readonly`, `disabled` | | | |
| `class` | class value | — | on the root (`hm-ge`) |

```tsx
<GradientEditor bind:value={$bg} preview={false} hint={false} angles={[0, 90, 180, 270]}
  labels={{ linear: "Straight", copy: "Copy the CSS", stop: (n, color) => `Color ${n} (${color})` }} />
```

Helpers: `gradientCss(g)`, `parseGradient(css)`, `colorAt(g, at)`.

## Accessibility

The dial and every stop are `role="slider"` (degrees / percent; arrows by 1, Shift by 10, Home / End). Stops share one
tab stop; Delete removes the focused stop. Quick angles and presets are named buttons; the preview has the CSS as its
label. The stop bar keeps the gradient's own left-to-right axis in every writing direction.

## Composed of

ColorPicker (selected stop), Segmented (type), IconButton (copy); the drag behavior (`hadi-march/behaviors/drag`) for dragging.
