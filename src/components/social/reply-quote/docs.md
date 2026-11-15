# ReplyQuote

The small box that shows which message is being answered: who said it and a cut of what was said, behind a coloured
bar. ChatBubble draws it over an answer; ChatComposer draws it above the field as the "replying to" preview.

```tsx
<ReplyQuote name="Deniz Kaya" text={m.text} />
<ReplyQuote variant="inverse" name="Deniz Kaya" text={m.text} onClick={() => jumpTo(m)} />
<ReplyQuote name="Replying to Deniz" text={m.text} lines={1} onClose={() => $replyTo = null} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `name` | text / node / accessor | — | first line: who is quoted, or your own line |
| `text` | text / node / accessor | — | the quoted text |
| `lines` | number | `2` | lines of the text kept; `0` shows all |
| `variant` | `soft` `inverse` | `soft` | `inverse`: inside a coloured bubble (bar and name in the text colour) |
| `m:color` | color token | `brand-orange` | Common prop (march/props): the colour token of the component and everything in it. |
| `bar` | boolean | `true` | the bar at the start edge |
| `onClose` | function | — | shows the cancel button and runs on it |
| `close` | boolean / icon | shown with `onClose` | `false`: no button; an icon: your own |
| `closeLabel` | string | "Cancel reply" | accessible name of the cancel button |
| `trail` | node | — | after the text: a thumbnail, your own control |
| `onClick` | function | — | makes the quote a button (jump to the quoted message) |
| `class` | class | — | |
| other attributes | | | `id`, `data-*`, `ref`, `aria-*` go to the box |

## Accessibility

The name and the text are plain text, read in order. With `onClick` they are one real button; the cancel button is a
separate button beside it (never nested) with its own name. The cut text stays whole for screen readers.

## Composed of

ClampText (the cut text), IconButton (cancel).
