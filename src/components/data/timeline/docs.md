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
| `items` | `{ time?, title?, body?, tone?, icon? }[]` / accessor | events in order |

`tone`: `info` `success` `warn` `danger`. `body` may be a node or a function that returns one.

## Accessibility

An `<ol>`: the order is announced. Times are `<time datetime="…">` with a machine-readable value. The connecting line
uses logical properties and mirrors in RTL.
