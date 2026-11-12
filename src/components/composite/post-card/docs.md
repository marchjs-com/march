# PostCard

One post of a social feed. The header shows the author (Avatar, name with a verified mark), the relative time and the
place, with an optional ⋯ Menu. Photos sit in a MediaGrid; a double tap on them likes the post with a large heart that
pops over the photo and bursts in the four HADİ colors. The action row has a LikeButton and rolling counts for comments
and shares; the caption folds to three lines with a "more" button.

```tsx
<PostCard post={post} onLike={(on) => like(post, on)} onComment={openComments} onOpenMedia={(i, el) => openLightbox(post.media, i, el)} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `post` | `Post` / accessor | — | `{ id, author: { name, handle, avatar, verified }, time, place, text, media, likes, liked, comments, shares }` |
| `onLike` | `(next, post) => void` | — | update the post optimistically |
| `onComment` | `(post) => void` | — | comment button and "View all N comments" |
| `onShare` | `(post) => void` | — | |
| `onOpenMedia` | `(index, el, post) => void` | — | open a MediaLightbox from the tile |
| `onAuthor` | `(post) => void` | — | makes the author a button (profile) |
| `menu` | `MenuItem[]` | — | ⋯ menu, items get `[post]` |
| `variant` | `card` `flat` | `card` | flat: no frame, a divider below |
| `clamp` | number | 3 | caption lines before "more" (0 = never fold) |
| `doubleTapLike` | boolean | true | |

## Accessibility

An `<article>` named "Post by …". The author, the menu, every count and "more" are buttons; counts are part of their
button's name ("Comments: 46"). The large heart and the burst are decorative; the LikeButton's `aria-pressed` carries
the state. Keyboard activation of a photo opens it at once.

## Composed of

Avatar, Menu, MediaGrid, LikeButton, CountRoll.
