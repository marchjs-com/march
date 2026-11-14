# CountRoll

An odometer number for likes, comments and followers. When the value changes only the digits that changed roll:
upward when it grows, downward when it shrinks, on the motion engine (global speed, pause and reduced motion apply).
The text is compact in the active locale (`1,2 B`, `12K`); `format="full"` groups it instead.

```tsx
<CountRoll value={$likes} />
<CountRoll value={$followers} format="full" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` | number / accessor | — | |
| `format` | `compact` `full` | `compact` | below 1000 both are the plain number |
| `hideZero` | boolean | false | nothing at 0 (a count next to an icon) |
| `duration` | ms | 320 | roll time |
| `formatter` | `(n) => string` | — | your own visible text (wins over `format`) |
| `roll` | boolean | true | `false`: digits change at once |
| `stagger` | ms | 24 | delay between neighbouring digits |
| `class` | string | — | on the root (`hm-roll`) |

```tsx
<CountRoll value={$likes} formatter={(n) => `${n} likes`} duration={600} stagger={60} />
<CountRoll value={$likes} roll={false} />
```

`formatCount(n, format)` returns the same text without the element.

## Accessibility

The rolling digits are `aria-hidden`; screen readers read the full value from a visually hidden copy. Inside a button
the count becomes part of the button's name.

## Composed of

Nothing: it is the count piece the social components share (LikeButton, PostCard, ProfileHeader, CommentThread).
