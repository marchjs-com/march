# ImageCropper

Crop an image the way phones do: the frame stays centered, the picture moves under it. Drag the image to move it,
zoom with the wheel, the slider or + −, turn it by 90° with the buttons (or R) and by fine angles with the angle slider
(or [ ]), mirror it (F), resize the frame from its corners or pick an aspect ratio. At any angle the image always
covers the frame, so the result never has empty corners. The result is drawn on a canvas (`api.toCanvas()`,
`api.toBlob()`); a small live preview shows it with its size in pixels.

```tsx
<ImageCropper src={url} bind:value={$crop} aspect={1} api={(c) => cropper = c} />
const blob = await cropper.toBlob("image/webp", 0.9, 512)
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `src` | string | — | same origin, `data:` or `blob:` (the canvas must be able to read it) |
| `alt` | string | — | describes the image for the crop area's label |
| `value` / `bind:value` | `CropState` | centered | `{ zoom, rotate, flip, x, y, aspect, w, h }` |
| `aspect` | number or `null` | — | a fixed ratio (hides the choices); `null` = free |
| `aspects` | `AspectOption[]` or `false` | free, 1:1, 4:3, 16:9, 3:4, 9:16 | |
| `maxZoom` | number | `4` | |
| `preview` | boolean | `true` | live result with its size |
| `api` | `(api) => void` | — | `toCanvas(width?)`, `toBlob(type?, quality?, width?)`, `reset()` |
| `grid` | boolean | `true` | the rule-of-thirds grid inside the frame |
| `hint` | boolean | `true` | the key hint under the crop area (`false`: screen readers only) |
| `tools` | boolean / `("rotateLeft" \| "rotateRight" \| "mirror" \| "reset")[]` | `true` | the buttons, or only the listed ones |
| `sliders` | boolean / `("zoom" \| "angle")[]` | `true` | the sliders, or only the listed ones |
| `size` | boolean | `true` | the "640 × 480 px" caption under the preview |
| `labels` | `{ cropper, area, role, hint, free, aspect, rotateLeft, rotateRight, mirror, reset, zoom, angle, result }` | — | own texts (each falls back to the built-in one) |
| `readonly`, `disabled` | | | |
| `class` | class value | — | on the root (`hm-crop`) |

```tsx
<ImageCropper src={url} aspect={1} grid={false} hint={false} tools={["mirror", "reset"]} sliders={["zoom"]}
  labels={{ zoom: "Size", reset: "Start over" }} />
<ImageCropper src={url} tools={false} sliders={false} preview={false} api={(c) => cropper = c} />   // only the crop area
```

Helpers: `coverScale`, `clampPan`, `frameSize`, `cropToCanvas`.

## Accessibility

The crop area is a focusable group described by its keys: arrows move the image (Shift: more), + − zoom, [ ] turn
by 1°, R by 90° (Shift+R back), F mirrors. Zoom and angle are labelled sliders; the buttons name their action and
the mirror button has `aria-pressed`; the result canvas is an image labelled "Cropped result".

## Composed of

Segmented (aspect), Slider (zoom, angle), IconButton (rotate, mirror, reset); the drag behavior (`hadi-march/behaviors/drag`) for dragging.
