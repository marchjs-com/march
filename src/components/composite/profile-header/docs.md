# ProfileHeader

The top of a profile. A cover (a photo, or a soft art of the four HADİ colors) with a bottom dim; the avatar in a
StoryRing that overlaps it and opens the stories; the name with a verified mark, the handle and the bio; stats as
buttons with rolling counts; a FollowButton, a Message button and a ⋯ Menu. Following adds you to the followers, so the
count rolls together with the button's morph. On your own profile an Edit button replaces follow and message.

```tsx
<ProfileHeader user={u} follow={$f} onFollow={(s) => $f = s} onMessage={openChat} onStat={openList} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `user` | `ProfileUser` | — | `{ name, handle, avatar, cover, bio, verified, story, posts, followers, following, private }` |
| `self` | boolean | false | Edit instead of follow / message |
| `follow` / `onFollow` | FollowState / `(next) => void` | — | |
| `onMessage` / `onEdit` | `() => void` | — | |
| `onStat` | `(which) => void` | — | makes the stats buttons |
| `onAvatar` | `() => void` | — | the ring opens the stories |
| `menu` | `MenuItem[]` | — | ⋯ |
| `cover` | `none` `sm` `md` `lg` | `md` | |

## Accessibility

A section named "Profile of …" with the name as a heading. The ring, stats, follow and message are buttons with
names; the cover is decorative.

## Composed of

StoryRing, FollowButton, CountRoll, Button, Menu.
