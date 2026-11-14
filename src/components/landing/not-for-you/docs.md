# NotForYou

The anti-landing block: it says plainly who the product is **not** for, and optionally who it is for. With `check`,
every "not for you" line is a toggle card: red at first, with "That's me" and a small "Not you? Tap it!"; a tap
strikes the line out, turns the card green and reveals the item's positive side (`instead`), with `markedHint` under the label ("You belong here"). A verdict under
the list says how many still apply.

```tsx
<NotForYou check items={[{ text: "You run a 1,000-seat conference", detail: "No ticketing; an event platform fits better." }]}
  forYou={[{ text: "You want to do something tonight" }]} />
<NotForYou variant="list" items={…} verdict={(n, total) => `${n}/${total}`} />
<NotForYou check items={…} meLabel="Sounds like me" hint="Tap if not" markedHint="Welcome"
  mark={(state) => (state === "not" ? "🙅" : state === "marked" ? "🎉" : "👍")} />   // own marks and texts
<NotForYou check items={…} mark={false} meLabel={false} hint={false} markedHint={false} verdict={false} title={false} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `{ text, detail?, instead? }[]` | — | who it is not for; `instead`: the positive side, shown once struck out |
| `forYou` | `{ text, detail? }[]` | — | who it is for (second column) |
| `title`, `forYouTitle` | node / `false` | "Not for you if…", "For you if…" | column headings; `false`: none |
| `check` | boolean | `false` | lines become toggles (strike out "not me"), a verdict appears |
| `verdict` | `(n, total) => node` / `false` | `notForYouVerdict` | the verdict text; `n` = struck-out lines; `false`: no verdict line |
| `variant` | `cards` `list` | `cards` | boxes, or lines with a rule |
| `onCheck` | `(marked: number[]) => void` | — | indexes of the struck-out lines |
| `meLabel` | node / `false` | "That's me" | label on every checkable card; `false`: none |
| `hint`, `markedHint` | node / `false` | "Not you? Tap it!", "Not you" | small text under the label, before / after a tap; `false`: none |
| `mark` | boolean / `(state, item, index) => node` | `true` | the round marks (cross / tick); `false`: none; a function draws your own for `state` `"not"`, `"marked"` (struck out) or `"for"` |
| `class` | string | — | extra class on the root (`.hm-nfy`; parts: `.hm-nfy-title`, `.hm-nfy-toggle`, `.hm-nfy-mark`, `.hm-nfy-me`, `.hm-nfy-verdict`) |

`notForYouVerdict(n, total)` is the default verdict: a prompt, "none of these is you", or how many still apply.

## Accessibility

Each line is a list item; with `check` it is a `button` with `role="checkbox"` and `aria-checked`. The verdict is a
`status` region, announced politely when it changes. The marks are decorative (`aria-hidden`); the headings say which
list is which. Two columns stack on narrow screens.

## Composed of

ListRow (a line), CheckMark (the round mark; its `motion` turns the cross into a tick).
