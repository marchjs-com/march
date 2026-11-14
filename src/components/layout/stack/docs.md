# Stack

Layout primitives. `Stack` lays children out in a column or a row with a gap from the spacing tokens (0–8),
alignment and justification, and optional wrapping. `Toolbar` is a labelled bar of controls with an end slot.
`Divider` is a horizontal rule, a labelled one ("or"), or a vertical separator between inline items.

```tsx
<Stack direction="row" gap={2} align="center" justify="between" wrap>…</Stack>
<Toolbar label="Filters" end={<Button>Export</Button>}>…</Toolbar>
<Divider label="or" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `direction` | `"column"` / `"row"` | `"column"` | Stack axis |
| `gap` | 0–8 | `3` | spacing token step |
| `align` / `justify` | `start` `center` `end` `stretch` `baseline` `between` | — | cross / main axis |
| `wrap` | boolean | `false` | rows wrap |
| `as` | tag | `"div"` | element to draw |
| Toolbar `label` / `end` | string / node | — | accessible name / end slot |
| Divider `label` / `vertical` | string / boolean | — | labelled or vertical divider |
| `class` | class | — | Stack, Toolbar and Divider each take one (roots `.m-stack`, `.m-toolbar`, `.m-divider`; Toolbar parts `.m-toolbar-start`, `.m-toolbar-end`) |

```tsx
<Divider class="my-rule" />   <Toolbar class="my-bar" label="Filters">…</Toolbar>
```

## Accessibility

Toolbar has `role="toolbar"` and a label; Divider is `role="separator"` (with `aria-orientation` when vertical).
Stack adds no semantics; `as` picks a meaningful element (`ul`, `section` …).

## Composed of

No other component.
