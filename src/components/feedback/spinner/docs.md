# Spinner

A ring that turns while something loads. Three sizes; in a multicolour theme (HADİ) it carries the brand colours, `colors` picks them (a list of colour tokens) or keeps it to one.

```tsx
<Spinner size="lg" colors="brand" label="Loading users" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `size` | `sm` `md` `lg` | `md` | |
| `colors` | `"brand"` / colour tokens / `"single"` | the theme's | a conic paint of the colours |
| `color` | colour token | the theme's | one colour for the ring (`brand-orange`, `success`…) |
| `label` | `string` / accessor | "Loading" (translated) | the accessible name |
| `class` | class value | | |

```tsx
<Spinner color="brand-orange" />
```

## Accessibility

`role="status"` with the label as its name, so screen readers hear what is loading. With reduced motion the ring
keeps turning slowly (a still ring reads as "stuck"); the speed follows the motion tokens.

## Composed of

Nothing: one element.
