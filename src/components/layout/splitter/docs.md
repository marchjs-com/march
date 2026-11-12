# Splitter

Two panes side by side with a handle between them. Drag the handle, or focus it and use ← → (mirrored in RTL),
Home / End for the limits and Enter to go back to the initial share. Each pane keeps at least `min` of the width.

```tsx
<Splitter start={<FileList />} end={<Preview />} initial={0.35} min={0.2} label="Resize the file list" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `start` / `end` | node | — | the two panes (logical order) |
| `initial` | number 0–1 | `0.5` | first pane's share |
| `min` | number 0–0.5 | `0.15` | smallest share of either pane |
| `label` | string | "Resize" | accessible name of the handle |

## Accessibility

The handle is a focusable `role="separator"` with `aria-valuenow` / `min` / `max` (percent) from the resize-handle
behavior; keyboard: arrows, Home / End, Enter.

## Composed of

No other component; the resize-handle behavior.
