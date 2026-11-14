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
| `initial` | number 0–1 | `0.5` | first pane's share (kept within `min` … 1 − `min`) |
| `min` | number 0–0.5 | `0.15` | smallest share of either pane |
| `value` | number 0–1 / accessor | — | controlled share of the first pane (with `onChange`) |
| `onChange` | `(share) => void` | — | the new share, while dragging or on the keyboard |
| `orientation` | `"horizontal"` / `"vertical"` | `"horizontal"` | side by side, or stacked |
| `label` | string | "Resize" | accessible name of the handle |
| `handle` | boolean / node | `true` | `false`: fixed panes with a plain divider; a node: your own grip drawn on the line |
| `color` | color token | accent | colour of the handle while hovered, focused or dragged |
| `class` | class | — | added to the root (`.m-splitter`); parts: `.m-split-pane`, `.m-split-handle`, `.m-split-grip` |

```tsx
<Splitter start={<A />} end={<B />} handle={<Icon of={moreVertical} />} color="brand-orange" />
<Splitter start={<A />} end={<B />} handle={false} initial={0.3} />   // fixed: nothing to drag
```

## Accessibility

The handle is a focusable `role="separator"` with `aria-valuenow` / `min` / `max` (percent) from the resize-handle
behavior; keyboard: arrows, Home / End, Enter.

## Composed of

ResizeHandle (the handle between the panes).
