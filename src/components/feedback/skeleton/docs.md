# Skeleton

Grey (or brand-tinted) shapes standing in for content that is loading: a few text lines or a block of a set height. Drawn in the shape of what comes, the page does not jump when the data arrives.

```tsx
{() => (loading() ? <Skeleton lines={3} /> : <Profile user={user()} />)}
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `lines` | `number` | `3` | text lines; the last one is shorter |
| `block` | `boolean` | `false` | one block instead of lines |
| `height` | `sm` `md` `lg` | `md` | block height, or the size of the circle |
| `shape` | `circle` | | one round shape (an avatar on its way); `--hm-skel-size` sets another size |
| `colors` | `"brand"` / `"single"` | the theme's | brand: a four-colour shimmer; single: neutral even in a multicolour theme |
| `shimmer` | `boolean` | `true` | `false`: still shapes, no moving light |
| `shortLast` | `boolean` | `true` | `false`: every line has the full width |
| `label` | `string` | "Loading" (translated) | accessible name of the lines |
| `class` | class value | | |

```tsx
<Skeleton lines={4} shimmer={false} shortLast={false} label="Loading the profile" />
<Skeleton shape="circle" height="lg" />
```

## Accessibility

The lines carry `aria-busy="true"` and the label "Loading" (translated); a block and a circle are `aria-hidden` (decorative, the
region around it says it is loading). The shimmer stops with reduced motion.

## Composed of

Nothing: spans.
