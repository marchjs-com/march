# CodeView

A read-only code block: line numbers, syntax colours for js / ts / jsx / tsx, css, html, json and sh (other languages
stay plain), a wrap toggle and a copy button. Text is inserted as text nodes, never as HTML. Every showcase Code tab
draws it through the `code-view` widget point.

```tsx
<CodeView code={source} lang="tsx" copy />
<CodeView code={css} lang="css" lineNumbers={false} wrap />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `code` | string / accessor | — | source |
| `lang` | string | — | language label and colours |
| `highlight` | boolean | on for a known `lang` | colour tokens |
| `lineNumbers` | boolean | `true` | |
| `wrap` | boolean | `false` | initial wrap state (the Wrap button toggles it) |
| `copy` | boolean | `true` | copy button |
| `label` | string / accessor | "Code" | accessible name of the scroll area |
| `tools` | node | — | extra toolbar controls |

## Accessibility

The code area is focusable (`tabindex=0`) so it scrolls from the keyboard; line numbers are `aria-hidden`, so copying or
reading gives only the code. The Wrap button reports its state with `aria-pressed`. Colours are theme text tokens and
stay readable in every theme.

## Composed of

CopyButton.
