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

## Accessibility

A named region. Buttons are real buttons (with `title` as tooltip and description, and the command's shortcut);
text items are text. A polite live region reads changes of `live` items. Hidden items stay reachable in the "…" menu.
Tones are never colour alone: the text says the state.

## Composed of

Menu (the … menu), Tooltip. Fitting from ui/fit, commands from `commandBinding`, the busy dot on the motion engine.
