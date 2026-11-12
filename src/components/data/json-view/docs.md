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

## Accessibility

`role="tree"` with nested groups; every object and array is a button with `aria-expanded`, so Tab and Enter / Space
open and close it.
