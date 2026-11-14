# Badge

A small label: a status in a tone, a dot badge (a coloured dot before the text, still or pulsing) or a count badge. Count badges hide at
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
| `dot` | boolean / node | `false` | dot before the text, or your own mark (an icon) |
| `dotColor` | ColorToken | the tone's text colour | colour of the built-in dot |
| `pulse` | boolean / `ring` / `blink` | `false` | the built-in dot pulses (a StatusDot); draws the dot by itself |
| `size` | `xs` `md` | `md` | `xs`: the mini badge on the corner of an icon button or a tab |
| `onClick` | `(event) => void` | — | a badge that can be pressed: drawn as a `<button>` |
| `pressed` | boolean / accessor | — | clickable badge: a toggle (`aria-pressed`) |
| `disabled` | boolean / accessor | — | clickable badge: cannot be pressed |
| `ariaLabel` | string / accessor | — | accessible name when the text alone does not say it |
| `count` | number / accessor | — | count badge |
| `max` | number | `99` | larger counts show `max+` |
| `showZero` | boolean | `false` | show a count of 0 |
| `label` | string / accessor | — | count badge accessible text after the number |
| `format` | `(n, max) => node` | `countLabel` | count badge: your own text for the number |
| `class` | class | — | extra class on the badge |

```tsx
<Badge dot dotColor="brand-orange">Live</Badge>
<Badge dot={<Icon of={heart} />}>Liked</Badge>
<Badge count={n} format={(n) => (n > 999 ? "1k+" : n)} />
<Badge tone="danger" pulse>Live</Badge>
<Badge size="xs" count={unread} label="unread" />
<Badge tone="info" onClick={() => openTypes()} ariaLabel="Type: string. Change">str</Badge>
<Badge count={hidden} tone="neutral" pressed={$open} onClick={() => { $open = !$open }} label="hidden rows" />
```

## Accessibility

Text badges are plain text. A count badge with `label` reads as "7 unread" instead of a bare number. With `onClick` the
badge is a real `<button>`: Tab reaches it, Enter and Space press it, it shows the focus ring, and `pressed` sets
`aria-pressed`. The dot (pulsing or not) is decorative; the pulse stops with reduced motion.

## Composed of

StatusDot (the pulsing dot).
