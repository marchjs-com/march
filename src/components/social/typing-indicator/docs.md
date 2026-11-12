# TypingIndicator

Three dots that lift in turn on the motion engine (a staggered loop; still with reduced motion) and an optional
sentence: "HADİ is typing…", "HADİ and Beta are typing…", "3 people are typing…". It is a polite status, so screen
readers hear the sentence once even when it is not shown. With no names it hides.

```tsx
<TypingIndicator names={$typing} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `names` | string[] | — | who is typing; empty hides it |
| `variant` | `bubble` `inline` | `bubble` | dots in a chat bubble, or a line |
| `text` | boolean | inline: true | show the sentence (always announced) |
| `color` | ColorToken | `brand-blue` | dot color |

`typingText(names)` returns the sentence.

## Accessibility

`role="status"` with `aria-live="polite"`; the dots are `aria-hidden`.

## Composed of

Nothing: ChatThread shows it under the last message.
