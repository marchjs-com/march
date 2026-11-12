# NumberInput

A locale-aware number: accepts `12,5` and `12.5`, never produces `NaN` (bad text marks the field invalid and is
put back on blur), clamps to `min` / `max` and steps with ArrowUp / ArrowDown. The family: **IntInput** (0 decimals),
**MoneyInput** (the currency symbol on the locale's side, the currency's decimals, grouping) and **PercentInput**
(shows 12.5 % for a stored 0.125).

```tsx
<Field label="Quantity"><NumberInput bind:value={$n} min={0} max={99} /></Field>
<Field label="Price"><MoneyInput bind:value={$price} currency="EUR" /></Field>
<Field label="Discount"><PercentInput bind:value={$rate} /></Field>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | `number \| null` | `null` | |
| `min`, `max` | number | — | clamped on blur and on steps |
| `step` | number | `1` | ArrowUp / ArrowDown, in display units |
| `decimals`, `minDecimals` | number | — | rounding and padding |
| `grouping` | boolean | `false` (money: `true`) | thousands separators when not editing |
| `scale` | number | `1` | display = value × scale |
| `locale` | string | app locale | |
| `currency` | ISO 4217 | `"USD"` | MoneyInput |
| `fraction` | boolean | `true` | PercentInput: `false` stores 12.5 for 12.5 % |
| `prefix`, `suffix` | node | — | |

`currencyInfo(locale, currency)` returns the symbol, its side and the minor digits.

## Accessibility

A text input with `inputmode="decimal"` (or `numeric` for whole, positive numbers) so phones show the right keypad;
invalid text sets `aria-invalid` until it is fixed or the field is left.

## Composed of

Nothing: one native input; Int, Money and Percent are NumberInput with preset props.
