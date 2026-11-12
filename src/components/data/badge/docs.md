# Badge

A small label: a status in a tone, a dot badge (a coloured dot before the text) or a count badge. Count badges hide at
0 (unless `showZero`), cap at `max` ("99+") and can carry an accessible label ("3 unread").

```tsx
<Badge tone="success">Active</Badge>
<Badge tone="warn" dot>Pending</Badge>
<Badge count={unread} label="unread" />
```

`countLabel(n, max)` formats a count the same way for your own markup.

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `tone` | `neutral` `primary` `info` `success` `warn` `danger` | `neutral` (count: `danger`) | colour family |
| `color` | ColorToken | theme primary | accent of the primary tone |
| `dot` | boolean | `false` | dot before the text |
| `count` | number / accessor | — | count badge |
| `max` | number | `99` | larger counts show `max+` |
| `showZero` | boolean | `false` | show a count of 0 |
| `label` | string / accessor | — | count badge accessible text after the number |

## Accessibility

Text badges are plain text. A count badge with `label` reads as "7 unread" instead of a bare number.
