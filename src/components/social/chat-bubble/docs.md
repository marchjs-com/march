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
| `labels` | `{ sending, sent, delivered, read, failed, edited, retry, react, reply }` | built-in texts | your own words; any subset |
| `color` | ColorToken | `brand-blue` | my bubble, the armed reply arrow, my reaction chips |
| `ticks` | boolean / `(status) => node` | `true` | delivery ticks: off, or your own mark |
| `formatTime` | `(date) => string` | locale short time | the time text |
| `replyHint` | boolean / node | `true` | the arrow shown while dragging |
| `swipe` | boolean | `true` | drag-to-reply; `false` keeps only the Reply button |
| `tools` | boolean | `true` | the React / Reply buttons on hover and focus |
| `reactIcon`, `replyIcon` | node | smile / arrow | your own icons for those buttons |
| `class` | string | — | on the row (`m-msg`) |

Every part is yours:

```tsx
<ChatBubble mine text="Done" status="read" color="brand-purple" labels={{ read: "Seen", edited: "changed", retry: "Try again" }}
  ticks={(s) => <b>{s === "read" ? "✓✓" : "✓"}</b>} formatTime={(d) => d.toLocaleTimeString("en", { hour: "numeric" })}
  replyHint={false} tools={false} />
```

Stable classes: `m-msg-bubble`, `m-msg-sender`, `m-msg-quote`, `m-msg-text`, `m-msg-meta`, `m-msg-edited`,
`m-msg-tick`, `m-msg-reacts`, `m-msg-react`, `m-msg-retry`, `m-msg-tools`, `m-msg-tool-react`, `m-msg-tool-reply`, `m-msg-hint`.

## Accessibility

Ticks are images named "Sent", "Read" …; reaction chips are buttons with `aria-pressed` named "❤️ 2". React and Reply
buttons appear on hover and keyboard focus, so drag-to-reply is never the only way.

## Composed of

Button, IconButton, ReplyQuote (the quote over an answer). ChatThread groups and draws these.
