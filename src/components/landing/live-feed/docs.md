# LiveFeed

A living wall: new activity slides in at the top (rows) or pops into the first cell (wall), and the oldest leaves, so
the page looks inhabited. Feed it a reactive list (`items`, newest first: from a socket or a store) or a `next()`
function the feed calls every `every` ms while it is on screen.

```tsx
<LiveFeed next={() => nextActivity()} every={2400} max={5} />
<LiveFeed items={$events} variant="wall" live="polite" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `FeedItem[]` / accessor | — | newest first; a new head slides in |
| `next` | `() => FeedItem \| null` | — | pulled every `every` ms while visible and not paused |
| `every` | ms | `2400` | clock time between pulls |
| `max` | number | `5` | items kept on screen |
| `variant` | `list` `wall` | `list` | rows, or a grid of cards |
| `label` | string | "Live activity" | accessible name |
| `live` | `off` `polite` | `off` | announce new items |
| `pausable` | boolean | `true` | the Live · pause button |

`FeedItem`: `{ id, title, body?, avatar?, meta?, color? }`.

## Accessibility

A labelled `section` with a list. Moving content can be stopped (WCAG 2.2.2): the feed pauses while the pointer or
keyboard focus is inside it, and the Live · pause button (`aria-pressed`) stops it until pressed again. New items are
not announced by default (a busy feed would talk over the page); `live="polite"` announces them, never while paused.
The feed only pulls while on screen and runs on the motion clock, so the global motion pause stops it too. Reduced
motion: items appear without sliding.

## Composed of

Motion engine (`onFrame`, `animate`), `IntersectionObserver`.
