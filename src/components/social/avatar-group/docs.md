# AvatarGroup

A row of overlapping avatars for the people of a thing (attendees, members, readers). The ones that do not fit become
a "+N" bubble. The bubble, the spacing, the colour and the shape are yours.

```tsx
<AvatarGroup names={["Ada", "Linus", "Grace", "Alan", "Margaret"]} max={4} />
<AvatarGroup names={[{ name: "Ada", src: url }, "Linus"]} spacing="gap" shape="square" more={(n) => <b>{n}+</b>} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `names` | `(string \| { name, src?, color? })[]` / accessor | | the people |
| `max` | `number` / accessor | `4` | avatars before "+N" |
| `size` | `xs` `sm` `md` `lg` `xl` | `sm` | |
| `label` | `string` / `(count) => string` | "N people" (translated) | accessible name of the group |
| `more` | `boolean` / `(rest) => node` | `true` | the "+N" bubble, or your own content in it |
| `spacing` | `overlap` `gap` | `overlap` | |
| `color` | color token | from each name | one colour for every avatar (a person's own wins) |
| `shape` | `circle` `square` | `circle` | |
| `class` | class value | | |

## Accessibility

`role="group"` named with the number of people; each avatar is an image named after its person, the bubble reads
"+N". Margins are logical, so the overlap mirrors in right-to-left text.

## Composed of

Avatar.
