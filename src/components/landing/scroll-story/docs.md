# ScrollStory

Scrollytelling. The media column stays pinned while the text steps scroll past; the step nearest the middle of the
viewport is active — its picture cross-fades in, the dots follow, and with `theme` the section takes that step's
colour. On phones the pinned media sits at the top and the steps flow under it.

```tsx
<ScrollStory steps={[
  { title: "Design", body: "…", media: <Mock />, color: "brand-orange" },
  { title: "Build", body: "…", media: <Chart />, color: "brand-blue" },
]} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `steps` | `{ title, body?, media, color? }[]` | — | `color`: a theme colour token |
| `side` | `start` `end` | `end` | media column side |
| `theme` | boolean | `true` | tint the section with the active colour |
| `onStep` | `(index) => void` | — | active step changed |

## Accessibility

Steps are articles with headings in reading order; only the active picture is exposed to screen readers (the others are
`aria-hidden`); the dots are decorative. Reduced motion swaps the pictures without movement.

## Composed of

`scrollScene`, motion engine, theme colour tokens (`data-hm-color`).
