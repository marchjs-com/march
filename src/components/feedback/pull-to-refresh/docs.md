# PullToRefresh

A scroll area that refreshes when its top is pulled down past a threshold, by touch, pen or mouse. A spinning indicator follows the pull and keeps turning until the async `onRefresh` settles.

```tsx
<PullToRefresh onRefresh={() => api.get("/feed").then((x) => $items = x)}>…</PullToRefresh>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `onRefresh` | `() => unknown` | | a returned promise keeps the indicator spinning until it settles |
| `threshold` | `number` (px) | `72` | pull distance that triggers it (the pull has 1:2 resistance) |
| `disabled` | `boolean` / accessor | `false` | |
| `onPhase` | `(phase) => void` | | `idle` → `pull` → `ready` → `refreshing` → `idle` |
| `class`, `children` | | | the element itself is the scroll area: give it a height |

## Accessibility

A visually hidden "Refresh" button appears on focus, so the refresh works from the keyboard. The state ("Pull to
refresh", "Release to refresh", "Refreshing…") is announced in a polite live region and the area is `aria-busy`
while refreshing. The pull only starts at the very top, so normal scrolling (and `touch-action` panning) is untouched;
the click that ends a mouse pull is swallowed. With reduced motion the indicator still spins (it reports progress) but
the content snaps back without a slide.

## Composed of

The refresh glyph, the motion engine (`animate`: settle and spin, transform only) and pointer events.
