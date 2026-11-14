# LiveFeed

A living wall: new activity slides in at the top (rows) or pops into the first cell (wall), and the oldest leaves, so
the page looks inhabited. Feed it a reactive list (`items`, newest first: from a socket or a store) or a `next()`
function the feed calls every `every` ms while it is on screen. It starts full and keeps its size: a leaving item is
lifted out of the flow while it fades and wall cards share one height, so the page never shifts.

```tsx
<LiveFeed next={() => nextActivity()} every={2400} max={5} />
<LiveFeed items={$events} variant="wall" live="polite" />
<LiveFeed next={next} enter="drop" leave="fall" glow={false} />
<LiveFeed next={next} enter={{ keyframes: { opacity: [0, 1], transform: ["rotate(-6deg) scale(.8)", "none"] }, duration: 500 }} />
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
| `enter` | preset / `{ keyframes, duration?, easing? }` | `flip` | how a new item arrives |
| `leave` | preset / `{ keyframes, duration?, easing? }` | `blur` | how the oldest leaves |
| `glow` | boolean | `true` | accent ring around a new item |
| `move` | boolean | `true` | the others glide to their new place (FLIP) |

`enter` presets: `flip` (3D swing out of a blur), `slide`, `fade`, `pop` (overshoot), `drop` (falls and bounces),
`zoom` (from in front), `blur` (sharpens out of a glow), `swing` (hangs and swings), `unfold` (blind), `glide` (from
the side, mirrored in RTL), `spin`. `leave` presets: `blur`, `fade`, `shrink`, `fall`, `slide`, `dissolve` (into
light), `fold`. The tables are exported as `FEED_ENTER` and `FEED_LEAVE`.

`FeedItem`: `{ id, title, body?, avatar?, meta?, color? }`.

## Accessibility

A labelled `section` with a list. Moving content can be stopped (WCAG 2.2.2): the feed pauses while the pointer or
keyboard focus is inside it, and the Live · pause button (`aria-pressed`) stops it until pressed again. New items are
not announced by default (a busy feed would talk over the page); `live="polite"` announces them, never while paused.
The feed only pulls while on screen and runs on the motion clock, so the global motion pause stops it too. Reduced
motion: items appear without sliding.

## Composed of

Motion engine (`onFrame`, `animate`), `IntersectionObserver`.
