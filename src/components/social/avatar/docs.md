# Avatar

A person's picture. Without an image (or when it fails to load) it shows the initials of the name on a colour taken
from the name, so the same person always has the same colour. Every part is yours: a ready text or an icon instead of
the initials, a fixed theme colour, the shape and the accessible name.

```tsx
<Avatar name="Ada Lovelace" src={url} size="lg" />
<Avatar name="Linus Torvalds" color="brand-orange" shape="square" />
<Avatar text="+3" color="neutral" />
<Avatar icon={user} label="Guest" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `name` | `string` / accessor | | initials, colour and accessible name come from it |
| `src` | `string` / accessor | | the image; a failed load falls back to the initials |
| `size` | `xs` `sm` `md` `lg` `xl` | `md` | |
| `text` | `string` / accessor | | ready text instead of the initials (`"+3"`) |
| `icon` | icon / node | | instead of the initials when there is no image |
| `color` | color token | from the name | one fixed theme colour |
| `shape` | `circle` `square` | `circle` | |
| `label` | `string` / accessor | the name, or "Avatar" (translated) | accessible name |
| `decorative` | `boolean` | `false` | hidden from screen readers (the name is next to it) |
| `loading` | `lazy` `eager` | `lazy` | image loading |
| `class` | class value | | |
| children | node | | own content instead of the image / initials |

`initials(name)` returns the letters ("Ada Lovelace" → "AL", upper-cased for the current locale).

## Accessibility

`role="img"` with the name as its accessible name (`label` overrides it); the image and the initials are hidden, so
the name is read once. `decorative` hides the whole avatar when the name is written beside it. Text on the colour uses
the theme "on" tokens.

## Composed of

—
