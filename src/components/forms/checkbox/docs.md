# Checkbox

One checkbox with its label. The box is drawn (the tick strokes in, the fill grows from the centre, it shrinks a little
when pressed) while the real `<input>` stays for the keyboard, forms and screen readers. Looks: `classic`, `soft`,
`chip`, `card` and `toggle`, each in three sizes and with the corner shapes that suit it (`shapesFor`).

```tsx
<Checkbox bind:value={$agree} label="I have read the terms" />
<Checkbox value={true} indeterminate label="Some items selected" />
<Checkbox variant="card" label="Team plan" hint="Up to 10 people" icon={users} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | boolean | `false` | |
| `label` or children | node | — | |
| `hint` | node | — | smaller text (the card's description) |
| `variant` | `classic` `soft` `chip` `card` `toggle` | `classic` | |
| `size` | `sm` `md` `lg` | `md` | |
| `shape` | `square` `rounded` `circle` | per variant | |
| `indeterminate` | boolean | — | the dash state |
| `onClick` | `(e: MouseEvent) => void` | — | the click on the input with its modifier keys (`e.shiftKey`: range selection) |
| `tabIndex` | number | — | tab order of the input (`-1` in a grid that moves focus with the arrow keys) |
| `icon` | icon | — | drawn instead of the tick |
| `color` | ColorToken | primary | |
| `animate` | boolean | `true` | off: no motion (reduced motion is always respected) |

Without a label only the box is drawn, for a selection cell of a table or a grid; name it with `aria-label`:

```tsx
<Checkbox value={$selected.has(row.id)} aria-label="Select row" onClick={(e) => toggle(row, { range: e.shiftKey })} />
<Checkbox value={$all} indeterminate={$some && !$all} aria-label="Select all rows" onChange={(on) => selectAll(on)} />
```

## Accessibility

A real `<input type="checkbox">` inside its `<label>`: Space toggles it, the indeterminate state is the native
property, focus shows a ring around the drawn box, and disabled is announced.

## Composed of

The selection-control drawing shared with CheckboxGroup and RadioGroup (forms/choice.ts).
