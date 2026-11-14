# Counter

An animated number. It counts up when it scrolls into view and glides to every new value; `mode="roll"` turns each
digit like an odometer (only the digits that change move). Formatting follows the locale through
`Intl.NumberFormat`: grouping, decimals, currency, percent, compact.

```tsx
<Counter value={12840} />
<Counter value={$price} mode="roll" format={{ style: "currency", currency: "EUR" }} />
<Counter value={0.98} format={{ style: "percent" }} />
<Counter value={$n} mode="none" />                       // no motion: the value just changes
<Counter value={12840} duration={3000} easing="bounce" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` | number / accessor | — | target |
| `from` | number | `0` | first value |
| `format` | Intl.NumberFormatOptions | — | currency, percent, compact … |
| `decimals` | number | `0` | fixed decimals |
| `prefix`, `suffix` | node | — | around the number |
| `mode` | `count` `roll` `none` | `count` | count up, odometer digits, or no motion |
| `duration` | ms | `1600` / `900` | |
| `easing` | easing name | `expo` | easing of the count (`out`, `spring`, `bounce`, `linear` …) |
| `start` | `visible` `now` | `visible` | |
| `class` | string | — | extra class on the root (`.m-counter`; parts: `.m-counter-view`, `.m-counter-affix`) |

`formatCount(n, { format, decimals })` formats like the counter.

## Accessibility

Screen readers read the final value (a visually hidden copy); the moving digits are `aria-hidden`. Tabular digits keep
the width steady. Reduced motion shows the value at once.

## Composed of

CountRoll (roll mode: the one odometer); motion engine (`animateValue`), `onVisible`.
