# Reveal

Children enter when the block scrolls into view: fade, rise, fall, slide from the start or the end (mirrored in RTL),
scale, blur or a 3D flip, one after another. `scrub` ties the effect to the scroll position. The motion engine plays it
(transform, opacity, filter); with reduced motion the content is simply there.

```tsx
<Reveal effect="up" stagger={80}>
  <Card>…</Card><Card>…</Card><Card>…</Card>
</Reveal>
<ul use:revealOnScroll={{ effect: "start" }}>…</ul>
<Reveal effect="blur" scrub>…</Reveal>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `effect` | `fade` `up` `down` `start` `end` `scale` `blur` `flip` | `up` | entrance |
| `stagger` | ms | `70` | delay between children |
| `delay`, `duration` | ms | `0`, `720` | |
| `distance` | px | `28` | travel of up / down / start / end |
| `scrub` | boolean | `false` | follow the scroll instead of playing once |
| `self` | boolean | `false` | animate the element, not its children |
| `select` | CSS selector | — | animate these descendants instead (cards inside a Grid) |
| `as` | tag | `div` | |

`revealOnScroll(el, options)` is the same as an action (`use:revealOnScroll`); `revealFrames(effect, distance, rtl)`
gives the start and end state.

## Accessibility

Only presentation changes: the content is in the document from the start and readable by screen readers. Reduced
motion skips the animation; without JavaScript-driven motion nothing stays hidden (`prefers-reduced-motion` shows it).

## Composed of

Motion engine (`animate`, `stagger`), `scrollScene`, `onVisible`.
