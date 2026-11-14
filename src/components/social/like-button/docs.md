# LikeButton

A heart toggle with a rolling count. Liking squashes and overshoots the heart on a spring, grows a ring and throws a
burst of particles in the four HADİ colors; unliking is a small press. Everything runs on the motion engine, so the
global speed, "pause all" and reduced motion apply (reduced motion keeps only the fill change).

```tsx
<LikeButton liked={$liked} count={$likes} onToggle={(on) => { $liked = on; $likes += on ? 1 : -1 }} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `liked` | boolean / accessor | — | |
| `onToggle` | `(next) => void` | — | the owner updates `liked` and the count (optimistic) |
| `count` | number / accessor | — | CountRoll next to the heart, hidden at 0 |
| `size` | `sm` `md` `lg` | `md` | |
| `color` | ColorToken | `brand-pink` | heart and ring color |
| `burst` | boolean | true | particles on like |
| `colors` | `brand` `single` | `brand` | particle colors |
| `label` | string | "Like" | accessible name |
| `icon` | node / `(liked) => node` | heart | your own icon (a March glyph fills with the color while liked) |
| `pop` | boolean | true | the pop of the icon on toggle |
| `burstOptions` | `{ count, radius, ring }` | — | shape of the burst |
| `countFormat` | `compact` `full` | `compact` | text of the count |
| `class` | string | — | on the button (`hm-like`; parts: `hm-like-hit`, `hm-like-heart`, `hm-like-count`) |

```tsx
<LikeButton liked={$on} onToggle={set} icon={<Icon of={star} />} color="brand-gold" label="Favourite"
  pop={false} burstOptions={{ count: 16, ring: false }} countFormat="full" />
```

`heartBurst(el, { count, radius, colors, ring })` and `heartPop(el, on)` are the same effects for any element: a
double-tap on a photo (PostCard), a comment, a story.

## Accessibility

A real `<button>` with `aria-pressed`; the count is part of its name. Space and Enter toggle it. The burst is
decorative (`aria-hidden`).

## Composed of

CountRoll.
