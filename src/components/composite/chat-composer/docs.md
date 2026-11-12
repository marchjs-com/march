# ChatComposer

The message field of a chat. On the start side an attach Menu whose + turns 45° while it is open; in the middle a
growing Textarea (Enter sends, Shift+Enter breaks the line) with an emoji button that opens a ReactionPicker grid (the
emoji goes in at the caret). On the end side one round button morphs on the motion engine: a microphone in Heyecan
orange while the field is empty, a send arrow in Aktivite blue once there is text. Recording replaces the field with a
pulsing dot, a running timer and a live waveform; the round button sends it, the trash button or Esc drops it. A reply
preview with an orange bar sits above.

```tsx
<ChatComposer onSend={(text) => send(text)} onVoice={sendVoice} attachments={[photo, file]} replyTo={$reply} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `onSend` | `(text) => void` | — | |
| `onVoice` | `(ms) => void` | — | enables the microphone |
| `attachments` | `MenuItem[]` | — | the attach menu |
| `emoji` | boolean | true | emoji panel |
| `replyTo` / `onCancelReply` | `{ name, text }` / `() => void` | — | |
| `onTyping` | `() => void` | — | at most once a second while typing |
| `placeholder` | string | "Message" | |
| `disabled` | boolean | — | |

## Accessibility

A form: the field is labelled "Message", the round button changes its name (Record voice message / Send / Send voice
message), the emoji button has `aria-expanded`, the attach menu is a Menu. "Recording" is announced as a status.

## Composed of

Menu, Textarea, ReactionPicker.
