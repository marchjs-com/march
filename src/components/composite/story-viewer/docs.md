# StoryViewer

Full-screen stories on a dark stage. StoryProgress bars fill on top; a tap on the start third goes back and anywhere
else forward (mirrored in RTL); pressing and holding pauses; a horizontal swipe moves to the next or previous person
with a slide; dragging down shrinks the story and closes it past 120 px (or a quick flick). The bottom bar has a reply
field (typing pauses) and a LikeButton. The next picture is preloaded. It is a Dialog: focus stays inside, Esc closes
and focus returns to the ring that opened it.

```tsx
<StoryViewer open={$open} onClose={() => $open = false} groups={stories} start={tappedId} onSeen={markSeen} onReply={send} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `open` / `onClose` | boolean / `() => void` | — | |
| `groups` | `StoryGroup[]` | — | `{ id, name, avatar, items: { id, src, alt, time, caption, duration }[] }` |
| `start` | index or id | 0 | person to start with |
| `duration` | ms | 6000 | per story (an item's `duration` wins) |
| `onSeen` | `(group, item) => void` | — | each story shown |
| `onReply` | `(group, item, text) => void` | — | shows the reply field |
| `onLike` / `liked` | `(group, item, on)` / `(group, item) => boolean` | — | shows the heart |

## Accessibility

A modal dialog named "Stories". ← / → move (mirrored in RTL), Space pauses, Esc closes; previous / next buttons
appear on hover and on keyboard focus, the pause button has `aria-pressed`. A polite live region says "Acme: story 2 of
3"; the progress bar has its own value text.

## Composed of

Dialog, Avatar, StoryProgress, LikeButton.
