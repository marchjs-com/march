# CheckboxGroup

Several checkboxes; the value is the array of checked option values. Every Checkbox look works (`chip` and `card` are
the usual ones for groups), `inline` lays them in a row, and `colors="brand"` gives each option the next HADİ color.

```tsx
<Field label="Days" group><CheckboxGroup bind:value={$days} inline variant="chip" options={days} /></Field>
<CheckboxGroup variant="card" options={[{ value: "team", label: "Team", hint: "Up to 10 people", icon: users, meta: "$49" }]} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | array | `[]` | |
| `options` | `[{ value, label, hint?, icon?, meta?, disabled? }]`, `[value]` or `"Mon, Tue"` | — | icon, hint and meta show in the card look; a comma-separated text: each part is a value and its label |
| `inline` | boolean | — | a row instead of a column |
| `variant`, `size`, `shape`, `color` | | | as Checkbox |
| `colors` | `"brand"` or tokens | — | one color per option in turn |
| `class`, `color`, `id`, `name`, `disabled`, `readonly`, `required`, `invalid`, `aria-label` | | — | the props every control takes; `color` is a theme token |

## Accessibility

A `role="group"` labelled by its Field (`<Field group>`); each option is a real checkbox with its own label, so Tab
reaches each one and Space toggles it.

## Composed of

The drawn selection box shared with Checkbox (forms/choice.ts).
