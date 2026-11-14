# NotForYou

The anti-landing block: it says plainly who the product is **not** for, and optionally who it is for. With `check`,
every "not for you" line is a toggle: the visitor strikes out the lines that are not them ("Not me!"), and a verdict
under the list says how many still apply.

```tsx
<NotForYou check items={[{ text: "You run a 1,000-seat conference", detail: "No ticketing; an event platform fits better." }]}
  forYou={[{ text: "You want to do something tonight" }]} />
<NotForYou variant="list" items={…} verdict={(n, total) => `${n}/${total}`} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `{ text, detail? }[]` | — | who it is not for |
| `forYou` | `{ text, detail? }[]` | — | who it is for (second column) |
| `title`, `forYouTitle` | node | "Not for you if…", "For you if…" | column headings |
| `check` | boolean | `false` | lines become toggles (strike out "not me"), a verdict appears |
| `verdict` | `(n, total) => node` | `notForYouVerdict` | the verdict text; `n` = struck-out lines |
| `variant` | `cards` `list` | `cards` | boxes, or lines with a rule |
| `onCheck` | `(marked: number[]) => void` | — | indexes of the struck-out lines |

`notForYouVerdict(n, total)` is the default verdict: a prompt, "none of these is you", or how many still apply.

## Accessibility

Each line is a list item; with `check` it is a `button` with `role="checkbox"` and `aria-checked`. The verdict is a
`status` region, announced politely when it changes. The marks are decorative (`aria-hidden`); the headings say which
list is which. Two columns stack on narrow screens.

## Composed of

Markup only; icons `x` and `check`.
