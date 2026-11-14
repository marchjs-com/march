# BeforeAfter

A before / after comparison: two layers on top of each other and a divider between them. Drag anywhere on the area (a
press jumps the divider there), move the handle with the keyboard, or set `follow` so the divider tracks the mouse
without a press. Horizontal or vertical; the horizontal one is mirrored in right-to-left text. The first time it
scrolls into view the divider sways once, so it reads as something to move.

```tsx
<BeforeAfter before={<img src="old.png" alt="" />} after={<img src="new.png" alt="" />} beforeLabel="Before" afterLabel="After" />
<BeforeAfter orientation="vertical" follow ratio="4 / 3" before={…} after={…} />
<BeforeAfter value={$pos} onChange={(v) => $pos.set(v)} before={…} after={…} />
<BeforeAfter grip={<Icon of={heart} />} step={5} valueText={(v) => `${v} percent of the old design`} before={…} after={…} />
<BeforeAfter grip={false} hint={false} before={…} after={…} />   // the line only, no sway
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `before`, `after` | node | — | the two layers (images, video, markup) |
| `beforeLabel`, `afterLabel` | node | — | corner chips; each fades when the divider covers it |
| `value` | number / accessor | `50` | divider position, 0–100 from the start |
| `onChange` | `(v) => void` | — | after a drag or key press |
| `orientation` | `horizontal` `vertical` | `horizontal` | |
| `follow` | boolean | `false` | the divider follows the mouse |
| `hint` | boolean | `true` | sway once when first visible |
| `ratio` | string | — | CSS aspect-ratio of the area |
| `label` | string | "Before and after" | accessible name |
| `grip` | boolean / node | `true` | the round grip on the divider: off (the line only) or your own content |
| `step` | number | `1` | keyboard step in percent (Shift and Page keys: 10 steps) |
| `valueText` | `(value) => string` | "40% before, 60% after" | the slider's value text for screen readers |
| `class` | string | — | extra class on the root (`.hm-ba`; parts: `.hm-ba-handle`, `.hm-ba-grip`, `.hm-ba-label`) |

## Accessibility

The handle is a `slider` (0–100) with a value text such as "40% before, 60% after". Arrow keys move it by 1 (Shift: 10),
Page Up / Down by 10, Home / End to the edges; arrows follow the reading direction. The corner labels repeat what the
layers show and are hidden from screen readers; give the images their own `alt`. Reduced motion skips the sway.

## Composed of

Badge (corner labels); `track` and `arrowStep` (behaviors/drag), the motion engine (`animateValue`) for the sway, `onVisible`.
