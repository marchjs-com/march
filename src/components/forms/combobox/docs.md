# Combobox

A text field with a list of matching options: static `options` filtered as you type (accent and case-insensitive), or
an async `search(q)` that is debounced, shows "Searching…" and ignores late answers. Arrow keys move, Enter picks,
Escape closes. `multiple` turns it into chips (see MultiSelect); `allowCustom` lets typed text become the value.

```tsx
<Field label="District"><Combobox bind:value={$town} options={towns} placeholder="Start typing" /></Field>
<Field label="Member"><Combobox bind:value={$userId} search={(q) => api.users(q)} labelOf={(id) => names[id]} /></Field>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | option value (array with `multiple`) | `null` | |
| `options` | `[value]` or `[{ value, label, hint, disabled }]` | — | static list |
| `search` | `(q) => options \| Promise<options>` | — | async list |
| `debounce` | ms | `250` | |
| `minChars` | number | `0` static / `1` async | |
| `limit` | number | `50` | |
| `renderOption` | `(o) => node` | label + hint | |
| `labelOf` | `(value) => string` | — | label of a value not in the options |
| `allowCustom`, `multiple` | boolean | — | |
| `onSelect` | `(option) => void` | — | |

## Accessibility

The WAI-ARIA combobox pattern: focus stays in the input (`role="combobox"`, `aria-expanded`, `aria-controls`), the
active option is announced through `aria-activedescendant`, the popup is a `role="listbox"` placed by the shared
positioning engine; loading, empty and error states are `role="status"`.

## Composed of

OverflowText (long chip labels); the list popup is the shared floating panel (ui/popover.ts) and keyboard handling is
the shared list navigation (forms/util.ts › listNav).
