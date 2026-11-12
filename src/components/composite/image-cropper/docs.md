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
| `readonly`, `disabled` | | | |

Helpers: `coverScale`, `clampPan`, `frameSize`, `cropToCanvas`.

## Accessibility

The crop area is a focusable group described by its keys: arrows move the image (Shift: more), + − zoom, [ ] turn
by 1°, R by 90° (Shift+R back), F mirrors. Zoom and angle are labelled sliders; the buttons name their action and
the mirror button has `aria-pressed`; the result canvas is an image labelled "Cropped result".

## Composed of

Segmented (aspect), Slider (zoom, angle), IconButton (rotate, mirror, reset); `dom/track` for dragging.
