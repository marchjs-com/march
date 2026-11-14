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
| `dots` | boolean | `true` | the dots under the pinned picture |
| `numbers` | boolean / `(index) => node` | `true` | the step number above each title ("01"), or your own |
| `transition` | `rise` `fade` `none` / `(incoming, outgoing, direction) => void` | `rise` | how the pinned picture changes |
| `class` | class | — | on the section |

```tsx
<ScrollStory steps={steps} numbers={(i) => `Step ${i + 1}`} dots={false} transition="fade" />
<ScrollStory steps={steps} numbers={false}
  transition={(incoming, outgoing, dir) => animate(incoming, { opacity: [0, 1], transform: [`rotate(${6 * dir}deg)`, "rotate(0deg)"] }, { duration: 600 })} />
```

## Accessibility

Steps are articles with headings in reading order; only the active picture is exposed to screen readers (the others are
`aria-hidden`); the dots are decorative. Reduced motion swaps the pictures without movement.

## Composed of

PageDots; `onScrollProgress` (motion scroll core), `swapTransition`, `observeSize`, theme colour tokens (`data-m-color`).
