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
| `badges` | boolean | `true` | status badge next to each title |
| `scroll` | boolean | `true` | fill with the scroll (off: full line) |

## Accessibility

An ordered list (Timeline) with `<time>` elements; the status is text (badge), not only colour. Reduced motion shows the
line full.

## Composed of

Timeline, Badge, Reveal; `scrollScene`.
