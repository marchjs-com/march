# Secret

A value with hidden parts: an API key, a card number, a phone number. `regions` lists the hidden ranges by character
index (`[start, end]`, end not included; a negative index counts from the end; no end = to the end). The default shows
the first and the last 4 characters; a value of 8 or fewer characters is hidden whole. The eye button shows the whole
value (`revealed`, with `bind:revealed` it is written back); `copy` adds a button that copies the real value, hidden or
not.

While a part is hidden its characters are not in the page at all: not in the DOM, not in the accessibility tree.
Screen readers hear the shown parts and "hidden, 12 characters".

```tsx
<Secret value={$key} />                                   // sk_l••••••••••••••••d05a
<Secret value={card} regions={[[4, 12]]} mask="*" />       // 4111********1111
<Secret value={$key} regions={[[8]]} maskLength={6} copy bind:revealed={$open} />
<Secret value={phone} regions={[[3, -2]]} toggle={false} size="sm" />
```

## Props

| Prop | |
|---|---|
| `value` | The value (it may be live). Required. |
| `regions` | Hidden ranges by index. Default `[[4, -4]]`. |
| `mask` | The character drawn for a hidden one. Default "•". |
| `maskLength` | Mask characters per hidden range: a number hides the length too. Default: the range's own length. |
| `revealed` / `bind:revealed` | Shown whole (live). `onRevealChange(revealed)` is called by the eye button. |
| `toggle` | The eye button. Default true. |
| `copy` | A button that copies the real value. Default false. `onCopy()` after copying. |
| `mono` | Monospace text. Default true. |
| `size` | sm · md (default). |
| `labels` | Own texts: `show`, `hide`, `copy`, `copied`, `hidden(count)`. |
| `class` | Extra classes on the root (`m-secret`). |

`secretParts(value, regions)` gives the value split into its shown and hidden parts (for your own drawing).

## Accessibility

- A hidden part is drawn as mask characters marked `aria-hidden`; screen readers hear "hidden, 12 characters" instead
  (`labels.hidden`). The hidden characters themselves are not in the page.
- The eye is a toggle button: its name says what it does ("Show" / "Hide") and `aria-pressed` says whether the value is
  shown.
- The copy button announces "Copied" (CopyButton).

Composed of IconButton (the eye) and CopyButton.
