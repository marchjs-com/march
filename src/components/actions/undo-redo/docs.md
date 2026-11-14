# UndoRedo

The undo / redo pair in the bar of an editor. Give it an undo stack (`undoStack()` / `undoHistory()` of
hadi-march/managers/undo) and it follows it: the buttons switch off when there is nothing to undo or redo, and the
tooltip names the step and the shortcut ("Undo: Rename (Ctrl+Z)"). Or drive it with four props.

```tsx
<UndoRedo history={history} />
<UndoRedo canUndo={$past.length > 0} canRedo={$future.length > 0} onUndo={undo} onRedo={redo} size="sm" />
<UndoRedo history={history} actions={["undo"]} shortcuts={false} labels={{ undo: "Step back" }} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `history` | `{ canUndo, canRedo, undo, redo, past?, future? }` | | an undo stack; replaces the four props below |
| `canUndo`, `canRedo` | `boolean` / accessor | from `history` | |
| `onUndo`, `onRedo` | `() => void` | `history.undo` / `redo` | |
| `actions` | `("undo" \| "redo")[]` | both | which buttons, in this order |
| `labels` | `{ undo?, redo?, group? }` | "Undo", "Redo", "History" (translated) | accessible names and tooltips |
| `steps` | `{ undo?, redo? }` / `false` | from `history.past` / `future` | step named after the label ("Undo: Rename"); `false`: never |
| `shortcuts` | `boolean` / `{ undo?, redo? }` | `true` (`mod+z`, `mod+shift+z`) | shortcut text in the tooltip |
| `icons` | `{ undo?, redo? }` | | |
| `partClass` | `{ undo?, redo? }` | | an extra class on a button (a host that keeps its own class names) |
| `size` | `xs` `sm` `md` `lg` | IconButton default | |
| `color` | color token | | colour of the icons |
| `disabled` | `boolean` / accessor | `false` | both buttons off (read-only editors) |
| `class` | class value | | |

The component shows the shortcut; binding the keys is the editor's job (`undoKeys(event, history)` of hadi-march/ui in
its `keydown` handler).

## Accessibility

A `group` named "History" with two IconButtons; the accessible name carries the step ("Undo: Rename"), the tooltip
adds the shortcut, written for the platform (⌘Z on macOS). A button with nothing to do is disabled, not hidden. The
arrows mirror in right-to-left text.

## Composed of

IconButton.
