# Joined

Parts drawn as one piece. Whatever goes in (cards, a code view, an input and a button, a preview and its code) loses
its own border, corners, margin and shadow; the whole has one frame and one radius, with a line between the parts.
One under the other (`vertical`, the default) or side by side (`horizontal`).

```tsx
<Joined>
  <Card title="Önizleme">…</Card>
  <CodeView code={code} lang="tsx" />
</Joined>
<Joined direction="horizontal" radius="full">
  <TextInput placeholder="Ara…" /><Button variant="primary">Ara</Button>
</Joined>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `direction` | `vertical` `horizontal` | `vertical` | one under the other, or side by side |
| `radius` | `0` `1` `2` `3` `4` `full` | the theme's radius (2) | corners of the whole (the theme's radius scale) |
| `border` | boolean | `true` | the frame around the whole |
| `dividers` | boolean | `true` | a line between the parts |
| `class` | class | — | root `.m-joined` |

Other attributes (`role`, `aria-*`, `data-*`) go to the element.

## Accessibility

A plain `div`: the parts keep their own roles. Give it `role="group"` and an `aria-label` when the parts form one
control (a search field and its button).

## Notes

Only the direct children lose their frame; what is inside a part keeps its own.
