# ReactionPicker

A row of emoji to react with, or a grid that serves as an emoji panel. It pops in (a spring scale and staggered emoji
on the motion engine); the picked emoji sits on a soft Aktivite circle; hovering lifts an emoji. Arrow keys move
between emoji (mirrored in RTL; up / down move by rows in the grid), Home / End jump.

```tsx
<ReactionPicker selected={msg.myReaction} onPick={(e) => react(msg, e)} />
<ReactionPicker layout="grid" onPick={insertAtCaret} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `onPick` | `(emoji) => void` | — | |
| `emojis` | string[] | `QUICK_REACTIONS` / `EMOJI_SET` | |
| `selected` | string | — | pressed |
| `layout` | `row` `grid` | `row` | |
| `onMore` | `() => void` | — | a + at the end of a row |
| `pop` | boolean | true | pop-in animation |
| `label` | string | "Reactions" | accessible name of the toolbar |
| `emojiLabel` | `(emoji) => string` | the emoji | accessible name of an emoji button |
| `moreLabel` | string | "More emoji" | accessible name of the + button |
| `moreIcon` | node | + | your own content for that button |
| `m:color` | ColorToken | `brand-blue` | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `class` | string | — | on the root (`m-react`; parts: `m-react-e`, `m-react-more`) |

```tsx
<ReactionPicker onPick={react} onMore={openPanel} color="brand-orange" pop={false} label="React to the photo"
  emojiLabel={(e) => NAMES[e] ?? e} moreLabel="All emoji" moreIcon={<Icon of={smile} />} />
```

## Accessibility

A `toolbar` of buttons with `aria-pressed`; one tab stop (roving focus), each emoji is its own name.

## Composed of

IconButton. ChatThread opens it under a message, ChatComposer uses the grid as its emoji panel.
