# ChatThread

A conversation. Messages become ChatBubbles grouped into runs per sender (5 minutes apart at most), with sticky day
separators ("Today", "Yesterday", a date). The TypingIndicator sits under the last message; the smile button of a
bubble opens a ReactionPicker under it. Motion: your new message rises from the composer on a spring, theirs slides in
from its side. While you are at the bottom it follows new messages; scrolled up, they wait behind a "↓ N new" button.
Rows are keyed, so an edit, a status or a reaction updates one bubble.

```tsx
<ChatThread messages={$messages} typing={$typing} group onReact={toggleReaction} onReply={(m) => $replyTo = m} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `messages` | `ChatMessage[]` | — | `{ id, text, mine, time, status, senderId, senderName, senderAvatar, reply, reactions, edited, image }` |
| `typing` | string[] | — | names typing now |
| `group` | boolean | false | sender names and avatars on runs |
| `onReact` | `(m, emoji) => void` | — | chips and the picker |
| `onReply` | `(m) => void` | — | |
| `onRetry` | `(m) => void` | — | failed messages |
| `runMinutes` | number | 5 | |
| `label` | string | "Messages" | |

`dayLabel(date)` gives the separator text.

## Accessibility

`role="log"` (new messages are announced politely) and focusable for keyboard scrolling. The picker takes focus when
it opens; Esc or a click elsewhere closes it. Day separators are `separator`s.

## Composed of

ChatBubble, TypingIndicator, ReactionPicker, Avatar.
