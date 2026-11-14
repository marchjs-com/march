# Timeline

An ordered list of events. Each item has an optional time, title, body, tone (the dot colour) and icon. A `Date`, epoch
milliseconds or an ISO string is formatted for the current locale; other text is shown as is.

```tsx
<Timeline items={[
  { time: "Today 09:12", title: "Order placed", body: "#48210 · 3 items", tone: "info" },
  { time: paidAt, title: "Payment received", tone: "success", icon: check },
]} />
```

## Props

| Prop | Type | |
|---|---|---|
| `items` | `{ time?, title?, body?, tone?, color?, icon? }[]` / accessor | events in order |
| `dot` | boolean / `(item, index) => node` | the dot of every item (default `true`), off, or your own mark |
| `line` | boolean | the connecting line (default `true`) |
| `formatTime` | `(value) => node` | your own text for a time (default: dates are formatted, text stays) |
| `class` | class | extra class on the list |

`tone`: `info` `success` `warn` `danger`; an item's `color` takes any theme colour token and wins over `tone`. `body`
may be a node or a function that returns one.

```tsx
<Timeline line={false} dot={(item, i) => <b>{i + 1}</b>} formatTime={(v) => relative(v)}
  items={[{ time: paidAt, title: "Payment received", color: "brand-purple" }]} />
```

## Accessibility

An `<ol>`: the order is announced. Times are `<time datetime="…">` with a machine-readable value. The connecting line
uses logical properties and mirrors in RTL.
