# HorizontalScroll

A pinned section whose panels move sideways while the page scrolls down: the vertical distance equals the track's
overflow, so the last panel arrives as the section ends. A progress line follows. RTL moves the other way. On touch
screens and with reduced motion it is a native horizontal scroller with snap points.

```tsx
<HorizontalScroll label="Case studies" panel="26rem">
  {cases.map((c) => <Card>…</Card>)}
</HorizontalScroll>
<HorizontalScroll progress={false}>…</HorizontalScroll>   // no progress line
<HorizontalScroll pinned={false}>…</HorizontalScroll>     // never pins: a sideways scroller with snap points
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `panel` | CSS length | `min(80vw, 32rem)` | width of every child |
| `label` | string | — | names the region |
| `progress` | boolean | `true` | the progress line under the panels |
| `pinned` | boolean | `true` | pin and move with the page scroll; `false`: always the native sideways scroller |
| `class` | string | — | extra class on the section (`.m-hs`; parts: `.m-hs-track`, `.m-hs-bar` (a Progress line)) |
| children | nodes | — | the panels |

## Accessibility

Content stays in reading order; keyboard users reach every panel with Tab (the page scrolls to it). Native mode on touch
and reduced motion keeps the usual swipe behaviour.

## Composed of

Progress (the line under the panels); `onScrollProgress` (motion scroll core), `observeSize`.
