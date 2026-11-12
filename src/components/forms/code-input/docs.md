# CodeInput

One-time code and PIN boxes. Typing moves forward, Backspace back, ← → move, a paste fills from the box (extra
characters are cut) and `onComplete` fires once when every box is filled. In the HADİ theme each box takes the next
HADİ color and the display font, as in the HADİ apps; boxes shrink on narrow screens instead of overflowing.

```tsx
<CodeInput length={6} groups={[3, 3]} onComplete={verify} />
<CodeInput length={8} pattern="alphanumeric" colors="palette" font="mono" variant="filled" />
<CodeInput length={4} mask size="lg" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | string | `""` | |
| `length` | 3–12 | `6` | |
| `pattern` | `numeric` `alpha` `alphanumeric` | `numeric` | numeric keypad and one-time-code autofill for numeric |
| `groups` | number[] | — | `[3, 3]` → a separator between groups |
| `mask` | boolean | — | dots (PINs) |
| `colors` | `single` `brand` `palette` or tokens | theme | one color per box |
| `font` | `display` `mono` `body` | theme | |
| `size` | `sm` `md` `lg` | `md` | |
| `variant` | `outline` `filled` `underline` | `outline` | |
| `uppercase` | boolean | letters: `true` | |
| `animate` | boolean | `true` | the pop when a character lands (motion engine; off with reduced motion) |
| `onComplete` | `(code) => void` | — | |

## Accessibility

A `role="group"` labelled by its Field; each box is named "Character 2 of 6". The first box carries
`autocomplete="one-time-code"` so SMS codes autofill. Codes read left to right in every language (`dir="ltr"`).

## Composed of

Nothing: native inputs; the pop animation runs on the motion engine.
