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
| `groups` | number[] or number | — | `[3, 3]` → a separator between groups; a number: boxes per group (`3` → `[3, 3]` for six) |
| `mask` | boolean | — | dots (PINs) |
| `colors` | `single` `brand` `palette` or tokens | theme | one color per box |
| `font` | `display` `mono` `body` | theme | |
| `size` | `sm` `md` `lg` | `md` | |
| `variant` | `outline` `filled` `underline` | `outline` | |
| `uppercase` | boolean | letters: `true` | |
| `animate` | boolean | `true` | the pop when a character lands (motion engine; off with reduced motion) |
| `onComplete` | `(code) => void` | — | |
| `separator` | `false`, node, text or `() => node` | a drawn dash | the mark between groups |
| `boxLabel` | `(position, length) => string` | "Character 2 of 6" | accessible name of a box |
| `animate` | boolean or `(box) => void` | `true` | `false`: no pop; a function: your own motion |
| `class`, `color`, `id`, `name`, `disabled`, `readonly`, `required`, `invalid`, `aria-label` | | — | the props every control takes; `color` is a theme token |

Your own parts: `<CodeInput groups={[3, 3]} separator="·" boxLabel={(i, n) => `${n} hanenin ${i}.`}
animate={(box) => animate(box, { opacity: [0, 1] }, { duration: 200 })} />`; `separator={false}` keeps the gap only.

## Characters (march/mask)

The characters a box takes are filtered by march/mask: digits typed on other keyboards (Arabic-Indic, Persian,
full-width) are read as 0–9, and letters become capitals in the app's locale (Turkish i → İ).

## Accessibility

A `role="group"` labelled by its Field; each box is named "Character 2 of 6". The first box carries
`autocomplete="one-time-code"` so SMS codes autofill. Codes read left to right in every language (`dir="ltr"`).

## Composed of

Nothing: native inputs; the pop animation runs on the motion engine.
