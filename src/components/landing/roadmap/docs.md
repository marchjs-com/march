# Roadmap

A Timeline whose line fills as you scroll: a product roadmap, a company story or a work history. Every entry has a
status (`done`, `now`, `next`); the dot of each entry the fill has passed lights up and the current one glows. The fill
is a transform written in the scroll scene's write phase.

```tsx
<Roadmap items={[
  { time: "2025 Q1", title: "First release", body: "…", status: "done" },
  { time: "2026 Q3", title: "Teams", body: "…", status: "now" },
  { time: "2027", title: "Plugins", body: "…", status: "next" },
]} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `{ time?, title, body?, status?, icon? }[]` | — | |
| `badges` | boolean / `(status, text) => node` | `true` | status badge next to each title, or your own mark |
| `scroll` | boolean | `true` | fill with the scroll (off: full line) |
| `rail` | boolean | `true` | the line and its fill (off: dots only) |
| `m:color` | color token | brand gradient + accent | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `labels` | `{ done?, now?, next? }` | `Done` `In progress` `Planned` | texts of the statuses |
| `reveal` | Reveal options / `false` | `{ effect: "start", stagger: 90 }` | entrance of the entries |
| `class` | class | — | on the root |

```tsx
<Roadmap items={items} m:color="brand-purple" labels={{ done: "Shipped", now: "Building", next: "Later" }} reveal={{ effect: "up" }} />
<Roadmap items={items} badges={(status, text) => <em>{text}</em>} rail={false} reveal={false} />
```

## Accessibility

An ordered list (Timeline) with `<time>` elements; the status is text (badge), not only colour. Reduced motion shows the
line full.

## Composed of

Timeline, Badge, Progress (the vertical rail), Reveal; `scrollIndicator` and `onScrollProgress` (motion scroll core).
