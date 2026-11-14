# ClampText

Text folded to a number of lines, with a "more" switch that appears only when the text is really cut, and "less" to
fold it again. Captions, bios, descriptions in cards and feeds.

```tsx
<ClampText lines={3}>{post.text}</ClampText>
<ClampText text={bio} lines={2} open={$open} onOpenChange={(v) => $open = v} labels={{ more: "read on", less: "fold" }} />
<ClampText lines={2} expandable={false}>{title}</ClampText>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `lines` | `number` / accessor | `3` | lines while folded; `0` never folds |
| `text` | text / node / accessor | | or children |
| `expandable` | `boolean` / `"always"` | `true` | `false`: the fold only; `"always"`: the switch without measuring |
| `collapsible` | `boolean` | `true` | "less" after opening |
| `open` | `boolean` / accessor | | controlled state |
| `defaultOpen` | `boolean` | `false` | first state when uncontrolled |
| `onOpenChange` | `(open) => void` | | |
| `labels` | `{ more?, less? }` | "more" / "less" (translated) | text or a node |
| `m:color` | color token | accent | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `as` | `p` `div` `span` | `p` | element of the text |
| `class` | class value | | |

## Accessibility

The switch is a real button with `aria-expanded` and `aria-controls` pointing at the text; the whole text stays in the
document while folded (screen readers read all of it). The fold is measured after layout and when the box resizes, so
a text that fits never shows a switch.

## Composed of

Button (`variant="link"`).
