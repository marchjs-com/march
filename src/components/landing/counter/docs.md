# Counter

An animated number. It counts up when it scrolls into view and glides to every new value; `mode="roll"` turns each
digit like an odometer (only the digits that change move). Formatting follows the locale through
`Intl.NumberFormat`: grouping, decimals, currency, percent, compact.

```tsx
<Counter value={12840} />
<Counter value={$price} mode="roll" format={{ style: "currency", currency: "EUR" }} />
<Counter value={0.98} format={{ style: "percent" }} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` | number / accessor | — | target |
| `from` | number | `0` | first value |
| `format` | Intl.NumberFormatOptions | — | currency, percent, compact … |
| `decimals` | number | `0` | fixed decimals |
| `prefix`, `suffix` | node | — | around the number |
| `mode` | `count` `roll` | `count` | count up, or odometer digits |
| `duration` | ms | `1600` / `900` | |
| `start` | `visible` `now` | `visible` | |

`formatCount(n, { format, decimals })` formats like the counter.

## Accessibility

Screen readers read the final value (a visually hidden copy); the moving digits are `aria-hidden`. Tabular digits keep
the width steady. Reduced motion shows the value at once.

## Composed of

Motion engine (`animateValue`), `rollDigits` (motion/digits.ts, shared with CountRoll), `onVisible`.
