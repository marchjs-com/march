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
| `m:color` | ColorToken | `brand-blue` | Common prop (march/props): the colour token of the component and everything in it. |
| `label` | `(names) => string` | `typingText` | your own sentence |
| `dots` | boolean / node | `true` | the three dots: off (text only), or your own node |
| `motion` | `lift` `fade` `none` | `lift` | how the dots move: lift, only light up in turn, or stay still |
| `class` | string | — | on the root (`m-typing`; parts: `m-typing-dots`, `m-typing-text`) |

```tsx
<TypingIndicator names={$typing} variant="inline" label={(n) => `${n.length} writing`} motion="fade" color="brand-orange" />
<TypingIndicator names={$typing} dots={false} text />
```

`typingText(names)` returns the sentence.

## Accessibility

`role="status"` with `aria-live="polite"`; the dots are `aria-hidden`.

## Composed of

StatusDot. ChatThread shows it under the last message.
