# CopyButton

Copies text to the clipboard. The button says "Copied" (or swaps its icon for a tick) for a moment and announces it;
when the clipboard is not available a toast reports the failure.

```tsx
<CopyButton text="npm i hadi-march" />
<CopyButton text={() => token} iconOnly label="Copy key" />
<CopyButton text={link} icon={share} label="Copy link" copiedLabel="Link copied" copiedIcon={heart} copiedColor="brand-blue" duration={3000} />
<CopyButton text={code} errorText={false} onError={report} />   // no toast: you handle the failure
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `text` | string / number / accessor | — | what is copied (read at click time) |
| `label` | string / accessor | "Copy" | button text, or accessible name when icon-only |
| `copiedLabel` | string / accessor | "Copied" | the text (or name) after a copy |
| `iconOnly` | boolean | `false` | icon button |
| `icon` | node / icon / `true` | copy glyph when icon-only | the copy icon; a text button shows one only when given |
| `copiedIcon` | node / icon / `false` | tick | the icon after a copy; `false` keeps the copy icon |
| `copiedColor` | color token | `success` | colour after a copy |
| `duration` | number (ms) | `1500` | how long the copied state stays |
| `errorText` | string / accessor / `false` | "Could not copy to the clipboard." | failure toast; `false`: no toast |
| `onCopy` | `() => void` | — | after a successful copy |
| `onError` | `(error) => void` | — | the clipboard refused |
| `class` | class | — | extra classes on the button |

## Accessibility

`aria-live="polite"`: the change to "Copied" is announced. The icon-only form keeps an accessible name that also
switches to "Copied".
