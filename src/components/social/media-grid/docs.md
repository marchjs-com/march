# MediaGrid

The photos of a post in one frame: one photo keeps its own shape (between 4:5 and 1.91:1), two sit side by side, three
are one large and two stacked, four are a 2×2 grid, and more show "+N" on the last tile. Each tile is a button that
opens the photo; a Skeleton shimmers until the image arrives and it then fades in. With `onDoubleTap` a single tap
waits 230 ms, so a double tap (like) never also opens the photo.

```tsx
<MediaGrid items={post.media} onOpen={(i, el) => openLightbox(post.media, i, el)} onDoubleTap={() => like(post)} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `MediaItem[]` | — | `{ src, alt, kind: "image" \| "video", width, height }` |
| `max` | 2–4 | 4 | tiles before "+N" |
| `shape` | `auto` `square` `portrait` | `auto` | auto keeps a single photo's shape |
| `gap` | `none` `thin` `gap` | `thin` | |
| `onOpen` | `(index, el) => void` | — | tap, Enter or Space |
| `onDoubleTap` | `(index, el) => void` | — | double tap with a pointer |

## Accessibility

A group named "N photos"; every tile is a button named by its alt text and "Photo i of n". Keyboard activation opens
at once (no double-tap wait). The video mark and "+N" are decorative; "+N" is part of the count in the group name.

## Composed of

Skeleton.
