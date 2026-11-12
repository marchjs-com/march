# FollowButton

Follow, Following or Requested (a private account asks first), with a morph between them: the pill's width springs
from one label to the other, the filled Aktivite background turns into an outline, the + turns into a tick, and a
small burst of the four HADİ colors marks a new follow (motion engine; with reduced motion only the state changes).
Hovering "Following" turns it red before you unfollow.

```tsx
<FollowButton state={$state} name={user.name} onChange={(s) => $state = s} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `state` | `follow` `following` `requested` | `follow` | |
| `onChange` | `(next) => void` | — | follow → following (or requested), back to follow |
| `private` | boolean | false | following sends a request |
| `name` | string | — | accessible name: "Follow HADİ" |
| `size` | `sm` `md` | `md` | 32 / 42 px |
| `block` | boolean | false | full width (no width morph) |

## Accessibility

A toggle button (`aria-pressed`) whose name says what pressing does: "Follow HADİ", "Following HADİ, press to
unfollow", "Follow request sent to HADİ, press to cancel".

## Composed of

Nothing: it borrows heartBurst from LikeButton for the follow burst.
