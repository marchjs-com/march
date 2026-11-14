# Spinner

A ring that turns while something loads. Three sizes; in a multicolour theme (HADİ) it carries the brand colours, `colors` picks them (a list of colour tokens) or keeps it to one.

```tsx
<Spinner size="lg" colors="brand" label="Loading users" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `size` | `sm` `md` `lg` `em` | `md` | `em`: the size and colour of the text around it |
| `decorative` | `boolean` | `false` | no role and no label: hidden from assistive technology |
| `colors` | `"brand"` / colour tokens / `"single"` | the theme's | a conic paint of the colours |
| `color` | colour token | the theme's | one colour for the ring (`brand-orange`, `success`…) |
| `label` | `string` / accessor | "Loading" (translated) | the accessible name |
| `class` | class value | | |

```tsx
<Spinner color="brand-orange" />
<button aria-busy="true"><Spinner decorative size="em" /> Saving…</button>
```

## Accessibility

`role="status"` with the label as its name, so screen readers hear what is loading. `decorative`
hides it (`aria-hidden`) where a text or a live region next to it already says so. With reduced motion the ring
keeps turning slowly (a still ring reads as "stuck"); the speed follows the motion tokens.

## Composed of

Nothing: one element.
