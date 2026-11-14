# CommandPalette

Ctrl/⌘+K opens a search over every registered command, every NavMenu page and every action, ranked with typo
tolerance. An optional `ask(query)` hook (an intent search the app provides) adds an "Ask" row: it runs on Enter, or by
itself when local results are weak. Only a small shell ships with the page; the dialog loads on first open, and hovering
or focusing a `PaletteButton` fetches it ahead of time.

```tsx
<CommandPalette ask={(q) => api.intent(q)} placeholder="Search pages or actions…" />
<PaletteButton label="Search…" />
registerCommands([{ id: "doc.new", title: "New document", group: "Document", shortcut: "mod+alt+n", run: create }])
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `ask` | `(query) => Promise<{ results }>` | — | intent search: ids of commands, pages or actions (or hrefs) with a reason |
| `askDelay` | number (ms) | `600` | when `ask` runs by itself on weak local results |
| `placeholder` | string (reactive) | `t` text | search field placeholder |
| `shortcut` | string or `false` | `"mod+k"` | toggle shortcut |
| `limit` | number | `50` | most local results |
| `commands` | `Command[]` | — | extra commands for this palette only |
| `onRun` | `(entry) => void` | — | called with the entry that ran |
| `labels` | `CommandPaletteLabels` | `t` texts | `{ dialog, search, results, empty, hint, suggested, asking, askFailed, ask(query) }` |
| `hint` | boolean or content | `true` | the key hint under the list: off, or your own content |
| `empty` | content | "No results" | own empty state |
| `askIcon` | icon, node or `false` | sparkles | icon of the Ask row |
| `class` | | | extra class on the dialog |

Functions: `openPalette()`, `closePalette()`, `paletteOpen()`, `preloadPalette()`, `registerCommands(list)` and
`registerPages(list)` (both return an unregister function). `PaletteButton` takes `label`, `shortcut`, `class`,
`icon` (own icon, or `false` for none) and `kbd` (`false` hides the shortcut hint).

```tsx
<CommandPalette labels={{ empty: "Nothing here", ask: (q) => `Ask the assistant: ${q}` }} hint={false} empty={<EmptyState />} />
<PaletteButton label="Search…" icon={command} kbd={false} />
```

## Accessibility

A modal Dialog with a labelled search field driving a `listbox` (`aria-activedescendant`); ↑ ↓ PageUp PageDown move, Enter
runs, Escape closes and focus returns to where it was. Rows show their shortcut as `kbd`; long titles scroll with
OverflowText. The trigger button announces its shortcut with `aria-keyshortcuts`.

## Composed of

Dialog (the modal frame and focus handling), OverflowText (long titles and the trigger label).
