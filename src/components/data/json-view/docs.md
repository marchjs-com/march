# JsonView

A collapsible, read-only JSON tree for API responses, settings and logs. Keys, strings, numbers, booleans and null have
their own theme colours; a closed object or array shows how many keys or items it holds. Dates print as ISO strings
and a circular reference is marked instead of looping.

```tsx
<JsonView value={response} open={1} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` | any / accessor | — | the data |
| `open` | number | `1` | depth expanded at start |
| `labels` | `{ items?, keys?, circular? }` | "items", "keys", "[circular]" | your own texts |
| `arrow` | boolean / `(open) => node` | `true` | the open / close arrow, off, or your own (`open()` is live) |
| `label` | string / accessor | — | accessible name of the tree |
| `describe` | `(value) => string \| null` | — | your text for a value that is not JSON (a function, an element, a signal): shown as a leaf; null leaves it to JsonView. Pass a function value as `() => fn` (a function `value` is read as an accessor) |
| `class` | class | — | extra class on the root |

```tsx
<JsonView value={response} labels={{ items: "entries", keys: "fields" }} arrow={(open) => <span>{() => (open() ? "−" : "+")}</span>} />
<JsonView value={response} arrow={false} />
```

## Accessibility

`role="tree"` with nested groups; every object and array is a button with `aria-expanded`, so Tab and Enter / Space
open and close it.

## Composed of

Chevron (the open / close arrow).
