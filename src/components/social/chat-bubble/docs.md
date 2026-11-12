# ChatBubble

One chat message. Mine is an Aktivite-blue gradient with light text, theirs the card color with a line. A run of one
sender's messages tightens the inner corners and only the last bubble keeps the small "tail" corner. Inside: the
sender's name in group chats (one of the four HADİ colors per sender), a reply quote with an orange bar, the text
(emoji-only messages grow and lose the bubble), time and delivery ticks (sending · sent · delivered · read · failed
with Retry) and reaction chips. Drag a bubble sideways to reply: an arrow appears, and past the threshold it fires when
you let go while the bubble springs back on the motion engine.

```tsx
<ChatBubble mine text="See you at 7" time={m.at} status="read" position="last" reactions={m.reactions} onReact={toggle} onReply={() => reply(m)} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `text` | string | — | |
| `mine` | boolean | false | |
| `position` | `single` `first` `middle` `last` | `single` | place in a run |
| `time` | date | — | short time in the active locale |
| `status` | `sending` `sent` `delivered` `read` `failed` | — | ticks (mine only) |
| `sender` / `senderColor` | string / 0–3 | — | group chats |
| `reply` | `{ name, text }` | — | quote |
| `reactions` | `{ emoji, count, mine }[]` | — | chips |
| `edited` | boolean | — | |
| `onReact` | `(emoji) => void` | — | a chip was pressed |
| `onReactMenu` | `(anchor) => void` | — | shows the React button |
| `onReply` | `() => void` | — | Reply button and drag-to-reply |
| `onRetry` | `() => void` | — | on a failed message |
| `children` | node | — | an image or a voice note above the text |

## Accessibility

Ticks are images named "Sent", "Read" …; reaction chips are buttons with `aria-pressed` named "❤️ 2". React and Reply
buttons appear on hover and keyboard focus, so drag-to-reply is never the only way.

## Composed of

Nothing: ChatThread groups and draws these.
