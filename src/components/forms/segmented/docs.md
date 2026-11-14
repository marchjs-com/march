# Segmented

A compact single choice: joined buttons, the chosen one raised. Use it for 2–6 short options (view modes, units,
periods). Arrow keys move and select; only the chosen button is in the Tab order.

```tsx
<Segmented bind:value={$view} options={[{ value: "list", label: "List" }, { value: "grid", label: "Grid" }]} aria-label="View" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | option value | `null` | |
| `options` | `[value]` or `[{ value, label, disabled }]` | — | |
| `color` | ColorToken | — | tints the chosen segment |
| `disabled`, `readonly` | boolean | — | |
| `class`, `color`, `id`, `name`, `disabled`, `readonly`, `required`, `invalid`, `aria-label` | | — | the props every control takes; `color` is a theme token |

## Accessibility

`role="radiogroup"` of `role="radio"` buttons with `aria-checked`; roving tabindex with ← → (mirrored in RTL),
Home and End through the shared focus helper.

## Composed of

Nothing: buttons with roving focus (ui/focus.ts).
