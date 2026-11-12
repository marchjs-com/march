# Parallax

Layered depth. Each layer (an image or any node, placed with Overlay) moves at its own speed while the section scrolls
past and, with `pointer`, shifts with the mouse by its depth, smoothed on the motion engine clock. Transform only;
layers get room to travel so no edge shows.

```tsx
<Parallax pointer={1} layers={[
  { src: "/sky.jpg", speed: 0.5 },
  { src: "/hills.png", speed: 0.25 },
  { content: <Shapes />, speed: -0.15 },
]}>
  <h2>Depth</h2>
</Parallax>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `layers` | `{ src?, alt?, content?, speed?, depth?, bleed?, opacity?, blend? }[]` | — | first = farthest |
| `pointer` | number | `0` | mouse strength (0 = off) |
| `height` | CSS length | `26rem` | minimum height |

`speed`: 0 stays with the section, positive is slower than the page (far away), negative faster (near).

## Accessibility

Layers are decorative Overlays (inert, hidden from screen readers unless an image has `alt`). Reduced motion keeps
every layer still. The scroll effect pauses while the section is off screen.

## Composed of

Overlay; `parallaxLayers` and `hoverParallax` (motion).
