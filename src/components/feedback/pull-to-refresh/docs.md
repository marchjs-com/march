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
| `labels` | `{ pull, release, refreshing, refresh }` | translated texts | the three announced states and the keyboard button |
| `indicator` | `boolean` / `(phase) => node` | `true` | `false`: no indicator; a function draws its own content inside it for every phase |
| `icon` | node / glyph | the refresh glyph | what turns inside the indicator |
| `m:color` | colour token | `primary` | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `settle` | `number` (ms) / `false` | `260` | how long the spring back takes; `false` snaps |
| `refreshButton` | `boolean` | `true` | the keyboard "Refresh" button shown on focus |
| `class`, `children` | | | the element itself is the scroll area: give it a height |

```tsx
<PullToRefresh onRefresh={load} icon={rotateCw} m:color="brand-orange" labels={{ pull: "Pull for new events", refresh: "Load new events" }}>…</PullToRefresh>
<PullToRefresh onRefresh={load} indicator={(phase) => (phase === "ready" ? "↑" : "↓")} settle={false}>…</PullToRefresh>
```

With `refreshButton={false}` give keyboard users another way to refresh.

## Accessibility

A visually hidden "Refresh" button appears on focus, so the refresh works from the keyboard. The state ("Pull to
refresh", "Release to refresh", "Refreshing…") is announced in a polite live region and the area is `aria-busy`
while refreshing. The pull only starts at the very top, so normal scrolling (and `touch-action` panning) is untouched;
the click that ends a mouse pull is swallowed. With reduced motion the indicator still spins (it reports progress) but
the content snaps back without a slide.

## Composed of

Button (the keyboard Refresh button). The swipe behavior (`swipeable`, `rubberBand`), the refresh glyph and the motion engine (`animate`: settle and spin, transform only).
