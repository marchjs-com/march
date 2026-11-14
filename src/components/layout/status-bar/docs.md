# StatusBar

The strip at the bottom of an editor or app. Items sit at the **start** or the **end** (writing direction), are plain
text or buttons (an action or a **command id** from the Command manager), and carry a tone: info, success, warn,
danger, or busy (a breathing dot on the motion engine). When the bar is too narrow, the lowest `priority` items move
to a "…" menu. Items marked `live` are announced when their text changes ("Saving…", "Saved").

```tsx
<StatusBar items={[
  { id: "branch", icon: gitBranch, text: "main", onSelect: pickBranch, priority: 5 },
  { id: "pos", side: "end", text: () => "Ln " + $line, priority: 4 },
  { id: "save", side: "end", text: () => $state, tone: () => $busy ? "busy" : "success", live: true, priority: 9 },
  { id: "format", side: "end", command: "editor.format" },
]} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `StatusItem[]` / accessor | — | `{ id, text, icon, side, tone, title, onSelect, command, priority, live }` |
| `label` | string | "Status bar" | accessible name of the region |
| `moreLabel` | string / accessor | "More status" | accessible name of the "…" menu |
| `moreIcon` | icon | `more` | icon of the "…" menu button |
| `overflow` | boolean | `true` | `false`: no "…" menu, every item stays in the bar |
| `dot` | boolean / `(tone, item) => node` | `true` | the tone dot of items without an icon: off, or your own mark (`tone()` is live) |
| `pulse` | boolean | `true` | `false`: the dot of a busy item stays still |
| `class` | class | — | added to the root (`.m-sbar`); parts: `.m-sbar-side`, `.m-sbar-item`, `.m-sbar-icon`, `.m-sbar-dot`, `.m-sbar-text`, `.m-sbar-more` |

```tsx
<StatusBar items={items} dot={false} />                                         // text and icons only
<StatusBar items={items} dot={(tone) => <b>{() => (tone() === "busy" ? "…" : "●")}</b>} pulse={false} />
<StatusBar items={items} moreLabel="Other states" moreIcon={chevronUp} />       // overflow={false}: no "…" menu
```

## Accessibility

A named region. Buttons are real buttons (with `title` as tooltip and description, and the command's shortcut);
text items are text. A polite live region reads changes of `live` items. Hidden items stay reachable in the "…" menu.
Tones are never colour alone: the text says the state.

## Composed of

ListRow (an item: its smallest size, plain form), Menu (the … menu), Tooltip, StatusDot (the tone dot; it blinks while busy). Fitting from ui/fit (`overflowFit`), commands from `commandBinding`; your own dot mark breathes on the motion engine.
