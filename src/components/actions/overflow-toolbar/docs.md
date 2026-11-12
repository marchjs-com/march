# OverflowToolbar

A toolbar that never wraps or squeezes: items that do not fit move to a **More** menu, lowest `priority` first, and
come back (with a short slide-in) when there is room again. An item is a plain action or a **command id**: the Command
manager then supplies its label, icon, shortcut, availability and busy state, so the palette, menus and this toolbar
always agree.

```tsx
<OverflowToolbar label="Document" items={[
  { id: "new", label: "New", icon: plus, onSelect: create, priority: 10 },
  { id: "save", command: "doc.save", priority: 9 },
  { id: "s1", separator: true },
  { id: "split", label: "Split", icon: columns, pressed: () => $split, onSelect: () => $split = !$split },
  { id: "delete", label: "Delete", icon: trash, danger: true },
]} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `ToolbarItem[]` / accessor | — | `{ id, label, icon, onSelect, command, pressed, disabled, shortcut, priority, showLabel, danger, separator }` |
| `label` | string | — | accessible name (required) |
| `size` | `sm` `md` | `sm` | |
| `end` | node | — | content after the items that never overflows |

With an icon, an item is icon-only (the label becomes its name and tooltip, with the shortcut) unless `showLabel`.
Separators next to a hidden item disappear; in the More menu they become menu separators.

## Accessibility

`role="toolbar"` with a name and one tab stop: ← → / Home / End move between the buttons (mirrored in RTL), the More
button included. Toggles use `aria-pressed`, shortcuts `aria-keyshortcuts`; icon-only buttons have names and tooltips
on hover and focus. Hidden items leave the tab order and appear as menu items.

## Composed of

Menu (the More menu), Tooltip (icon buttons). Fitting is the shared `fitItems` / `observeWidth` (ui/fit), commands come
from `commandBinding` (managers/command/ui), roving focus from ui/focus.
