# BranchingStory

A choose-your-own-path story. Every passage ends in choices; the reader's path collects as a trail at the top (any step
rewinds the story to it) and the endings found so far are counted. A pick lights the chosen button, fades the others
and turns the page: the new passage swings in from the reading direction, from the other side when going back, and
mirrored in right-to-left text. Keys 1–9 pick a choice.

```tsx
<BranchingStory start="intro" action={<Button>Join</Button>} passages={{
  intro: { title: "Saturday morning", body: "…", choices: [{ label: "Look around", to: "explore" }, { label: "Host", to: "host", note: "a few steps" }] },
  explore: { body: "…", choices: [{ label: "The run", to: "friends" }] },
  friends: { title: "New friends", body: "…", ending: "Social butterfly" },
}} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `passages` | `Record<id, { title?, body, media?, choices?, ending?, color? }>` | — | a passage without choices is an ending |
| `start` | string | — | first passage |
| `path` | `string[]` / accessor | `[start]` | restore or drive the path |
| `onChange` | `(path) => void` | — | after every choice or rewind |
| `trail` | boolean | `true` | the trail of choices |
| `endings` | boolean | `true` | "Endings found: 2 / 4" |
| `action` | node | — | next to "Start again" at an ending |
| `minHeight` | CSS length | `20rem` | the stage keeps it, so the page does not jump |
| `label` | string | "Story" | accessible name |

A choice is `{ label, to, note? }`. `storyEndings(passages, start)` lists every reachable ending.

## Accessibility

A labelled `section`. The trail is a `nav` with an ordered list; the current step has `aria-current="step"`, earlier
steps are buttons. Choices are buttons in an ordered list; the number keys 1–9 press them. After a choice, focus moves
to the new passage's heading, so screen readers read the new passage. Reduced motion swaps passages without the turn.

## Composed of

Motion engine (`animate`), `storyEndings`.
