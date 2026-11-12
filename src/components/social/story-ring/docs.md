# StoryRing

An Avatar inside a ring that tells the story state: `new` sweeps the four HADİ colors (and pink), `seen` is a quiet
line, `close` is the friends-only green, `none` has no ring. As a button it opens the stories, and while they load the
ring turns on the motion engine. A `+` badge marks your own ring (add a story); a label under it makes a story tray.

```tsx
<StoryRing name={u.name} src={u.avatar} state={u.seen ? "seen" : "new"} label={u.handle} onClick={() => open(u)} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `name` | string | — | initials and accessible name |
| `src` | string | — | photo |
| `state` | `new` `seen` `close` `none` | `new` | |
| `size` | `sm` `md` `lg` | `md` | 40 / 58 / 88 px |
| `label` | string | — | text under the ring |
| `add` | boolean | false | + badge |
| `loading` | boolean | false | the ring turns |
| `onClick` | `(e) => void` | — | makes it a button |

## Accessibility

A button (or an image) named with the state: "Acme, new story" / "Acme, story seen". `aria-busy` while loading. The
ring and the badge are decorative.

## Composed of

Avatar.
