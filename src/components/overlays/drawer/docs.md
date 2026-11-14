# Drawer

A sheet that slides in from an edge: `start` / `end` (mirrored in right-to-left layouts), `top` or `bottom`. It can be dragged toward its edge to close, rest on snap points, and be modal (scrim, focus trap, the page inert) or non-modal (the page stays usable).

```tsx
<Drawer open={$open} onClose={() => $open = false} side="bottom" snapPoints={[0.4, 0.9]} title="Filters">…</Drawer>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `open` | `boolean` / accessor | | shown while true; closing animates out first |
| `onClose` | `() => void` | | Escape, scrim, ×, or a drag past the edge |
| `side` | `start` `end` `top` `bottom` (`left` = start, `right` = end) | `end` | read when it opens |
| `modal` | `boolean` | `true` | false: no scrim, no focus trap, no scroll lock |
| `dragToClose` | `boolean` | `true` | needs `dismissable` |
| `snapPoints` | `number[]` | | fractions of the viewport (`0.4`) or pixels (`320`); the largest sets the panel size, cut down to the content: a short sheet is as tall as its content |
| `snap` / `onSnap` | `number` / `(i) => void` | `0` | index into `snapPoints`: it opens at the first listed point |
| `size` | `sm` `md` `lg` `full` | `md` | without snap points: the largest size; top / bottom sheets are as tall as their content up to it, then the body scrolls (handle and head stay) |
| `handle` | `boolean` | `true` | the grab handle (top / bottom sheets and with snap points); the head can still be dragged without it |
| `handleLabel` | `string` | "Resize panel" | accessible name of the handle button (snap points) |
| `motion` | `boolean` / `{ duration, exit, easing }` | `true` (300 ms in, 220 ms out, `easeOutCubic`) | `false`: it appears and leaves at once; an object sets your own timing and motion engine easing |
| `closeButton`, `closeLabel` | | | the × in the head, as in Dialog (`false`: none; an icon or node: your own) |
| `title`, `label`, `footer`, `dismissable`, `class` | | | as in Dialog |
| `target` | `"nearest"` `"page"` element | `"nearest"` | where it opens: the nearest `<OverlayScope>`, the whole page, or a scope element |

```tsx
<Drawer open={$open} onClose={close} side="bottom" handle={false} closeButton={false} title="Filters">…</Drawer>
<Drawer open={$open} onClose={close} side="end" motion={{ duration: 520, exit: 300, easing: "easeOutBack" }} title="Details">…</Drawer>
<Drawer open={$open} onClose={close} motion={false} title="Details">…</Drawer>
```

## Accessibility

`role="dialog"`, labelled by the title (or `label`); `aria-modal` only when modal. Escape closes the topmost one, focus
moves in and returns to the opener. With snap points the grab handle is a button ("Resize panel") that steps through
them with Enter / Space, so every size is reachable without a pointer. With reduced motion the panel appears at once.

Content longer than the sheet scrolls in the body only (`overscroll-behavior: contain`; the modal layer locks the page,
iOS included). At a smaller snap point the body ends at the screen edge, so its last line can be scrolled to. A drag
on the body scrolls it first; at its top, dragging down moves the sheet (and closes it past the smallest point).

## Composed of

Dialog's frame (focus trap, Escape stack, scroll lock, PanelHeader head / body / foot) inside a Portal layer (`drawer` when modal,
`popover` otherwise); movement through the motion engine (`animate`, transform only).
