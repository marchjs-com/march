# StatsBand

A row of big numbers that count up when the band scrolls into view (Counter), each with a label and an optional note.
Plain, divided by lines, or as cards.

```tsx
<StatsBand items={[
  { value: 12000, label: "teams", format: { notation: "compact" }, suffix: "+" },
  { value: 99.98, decimals: 2, suffix: "%", label: "uptime" },
]} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `{ value, label, note?, format?, decimals?, prefix?, suffix? }[]` | — | `value`: a number, or an accessor (a new value is counted to) |
| `variant` | `plain` `divided` `cards` | `divided` | |
| `mode` | `count` `roll` `none` | `count` | Counter style; `none` writes the number without counting |
| `duration` | ms | Counter's (`1600`) | how long each figure counts |
| `easing` | easing name | Counter's (`expo`) | easing of the count, e.g. `in-out` |
| `m:color` | color token | text colour | Common prop (march/props): the colour token of the component and everything in it. |
| `reveal` | Reveal options / `false` | `{ effect: "up", stagger: 90 }` | entrance of the items |
| `class` | class | — | on the list |

```tsx
<StatsBand items={stats} m:color="brand-orange" reveal={{ effect: "scale", stagger: 140 }} />
<StatsBand items={stats} mode="none" reveal={false} />
// count only once the whole band is in view, three seconds each: the values wait at 0 until then
<StatsBand items={stats.map((s) => ({ ...s, value: () => (shown() ? s.value : 0) }))} duration={3000} easing="in-out" />
```

## Accessibility

A description list: each label is a `<dt>`, the number a `<dd>` (read as its final value). The number is shown first
with CSS order only, so the reading order stays label → value.

## Composed of

StatTile (each item), Counter, Reveal.
