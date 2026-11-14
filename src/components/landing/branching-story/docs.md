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
<BranchingStory start="intro" passages={…} transition="slide" keys={false}
  labels={{ start: "Home", restart: "Once more", endings: (found, total) => `${found} of ${total} endings` }}
  renderChoice={(choice, i) => <b>{i + 1}. {choice.label}</b>} />
<BranchingStory start="intro" passages={…} restart={false} trail={false} transition={(side) => ({
  leave: { opacity: [1, 0], transform: ["scale(1)", "scale(.9)"] },
  enter: { opacity: [0, 1], transform: [`translateY(${40 * side}px)`, "translateY(0px)"] }, duration: 500 })} />
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
| `labels` | `{ path, start, endings, missing, end, endingPrefix, restart }` | translated | every text the story writes; `endings`: `(found, total) => node` |
| `restart` | boolean | `true` | the "Start again" button at an ending |
| `keys` | boolean | `true` | number keys 1–9 pick a choice; each choice shows its number |
| `renderChoice` | `(choice, index) => node` | — | draw the content of a choice button yourself |
| `transition` | `turn` `slide` `fade` `none` / `(side) => { leave, enter, duration?, easing? }` | `turn` | how the page changes; a function gives keyframes for the leaving and the entering passage (`side`: 1 forward, -1 back) |
| `class` | string | — | extra class on the root (`.hm-bs`; parts: `.hm-bs-trail` (a Breadcrumbs: steps are `.hm-bc-item`), `.hm-bs-found`, `.hm-bs-passage`, `.hm-bs-choice`, `.hm-bs-key`, `.hm-bs-end`) |

A choice is `{ label, to, note? }`. `storyEndings(passages, start)` lists every reachable ending.

## Accessibility

A labelled `section`. The trail is a `nav` with an ordered list (Breadcrumbs); the current step has `aria-current`, earlier
steps are buttons. Choices are buttons in an ordered list; the number keys 1–9 press them (unless `keys={false}`). After a choice, focus moves
to the new passage's heading, so screen readers read the new passage. Reduced motion swaps passages without the turn.

## Composed of

ListRow (a choice: key, label, note), Kbd, Breadcrumbs (the trail, in a pill look), Badge (ending), Button (start again); `swapTransition` and the motion engine, `storyEndings`.
