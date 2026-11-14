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
<LiveFeed next={next} pauseLabel="On air · stop" resumeLabel="Stopped · go on" pulse={false} pauseOnHover={false}
  renderItem={(item) => <><b>{item.title}</b> <small>{item.meta}</small></>} />   // own rows, own button texts
<LiveFeed next={next} enter="none" leave="none" glow={false} move={false} />        // no motion at all
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `FeedItem[]` / accessor | — | newest first; a new head slides in |
| `next` | `() => FeedItem \| null` | — | pulled every `every` ms while visible and not paused |
| `every` | ms | `2400` | clock time between pulls |
| `first` | ms | `every` | time before the first pull |
| `max` | number | `5` | items kept on screen |
| `variant` | `list` `wall` | `list` | rows, or a grid of cards |
| `label` | string | "Live activity" | accessible name |
| `live` | `off` `polite` | `off` | announce new items |
| `pausable` | boolean | `true` | the Live · pause button |
| `pauseLabel`, `resumeLabel` | node | "Live · pause", "Paused · resume" | text of the pause button, running / paused |
| `pulse` | boolean | `true` | the pulsing dot in the pause button |
| `pauseOnHover` | boolean | `true` | pause while the pointer or focus is inside |
| `renderItem` | `(item) => node` | — | draw an item yourself (the content of its row / card) |
| `enter` | preset / `"none"` / `{ keyframes, duration?, easing? }` | `flip` | how a new item arrives |
| `leave` | preset / `"none"` / `{ keyframes, duration?, easing? }` | `blur` | how the oldest leaves |
| `glow` | boolean | `true` | accent ring around a new item |
| `move` | boolean | `true` | the others glide to their new place (FLIP) |
| `class` | string | — | extra class on the root (`.m-lf`; parts: `.m-lf-pause`, `.m-lf-list`, `.m-lf-item` (a ListRow: `.m-listrow-title`, `-sub`, `-trail`), `.m-lf-avatar`) |

`enter` presets: `flip` (3D swing out of a blur), `slide`, `fade`, `pop` (overshoot), `drop` (falls and bounces),
`zoom` (from in front), `blur` (sharpens out of a glow), `swing` (hangs and swings), `unfold` (blind), `glide` (from
the side, mirrored in RTL), `spin`. `leave` presets: `blur`, `fade`, `shrink`, `fall`, `slide`, `dissolve` (into
light), `fold`. The tables are exported as `FEED_ENTER` and `FEED_LEAVE`.

`FeedItem`: `{ id, title, body?, avatar?, meta?, color? }`.

## Accessibility

A labelled `section` with a list. Moving content can be stopped (WCAG 2.2.2): the feed pauses while the pointer or
keyboard focus is inside it (keep `pauseOnHover` on unless the page has another way to stop it), and the Live · pause button (`aria-pressed`) stops it until pressed again. New items are
not announced by default (a busy feed would talk over the page); `live="polite"` announces them, never while paused.
The feed only pulls while on screen and runs on the motion clock, so the global motion pause stops it too. Reduced
motion: items appear without sliding.

## Composed of

ListRow (an item), Avatar, StatusDot, Button (pause); motion engine (`onFrame`, `animate`), `whenVisible`.
