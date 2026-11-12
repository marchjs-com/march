# CopyButton

Copies text to the clipboard. The button says "Copied" (or swaps its icon for a tick) for a moment and announces it;
when the clipboard is not available a toast reports the failure.

```tsx
<CopyButton text="npm i hadi-march" />
<CopyButton text={() => token} iconOnly label="Copy key" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `text` | string / number / accessor | — | what is copied (read at click time) |
| `label` | string / accessor | "Copy" | button text, or accessible name when icon-only |
| `iconOnly` | boolean | `false` | icon button |
| `onCopy` | `() => void` | — | after a successful copy |

## Accessibility

`aria-live="polite"`: the change to "Copied" is announced. The icon-only form keeps an accessible name that also
switches to "Copied".
