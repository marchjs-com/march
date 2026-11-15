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
| `labels` | `ChatComposerLabels` | built-in texts | `{ message, emoji, attach, send, record, sendVoice, cancelRecording, cancelReply, recording, replyingTo(name) }`: own names for the field and the buttons, the reply line and the recording status |
| `attachIcon` `emojiIcon` `sendIcon` `micIcon` | icon, text or node | plus, smile, arrow, microphone | own icons |
| `sendColor` / `micColor` | color token | `brand-blue` / `brand-orange` | color of the round button in each state |
| `wave` | boolean | true | the live waveform while recording |
| `recordingDot` | boolean | true | the pulsing dot while recording |
| `motion` | boolean | true | `false`: no morph, reply slide, waveform or pulse |
| `class` | | | on the form |

```tsx
import { arrowUp } from "march/icons"
<ChatComposer onSend={send} sendIcon={arrowUp} sendColor="brand-green" micColor="brand-purple"
  labels={{ message: "Write to the club", replyingTo: (name) => `Answer to ${name}` }} wave={false} motion={false} />
```

## Accessibility

A form: the field is labelled "Message", the round button changes its name (Record voice message / Send / Send voice
message), the emoji button has `aria-expanded`, the attach menu is a Menu. "Recording" is announced as a status.

## Composed of

Menu, Textarea, ReactionPicker, IconButton, StatusDot, ReplyQuote (the reply preview).
