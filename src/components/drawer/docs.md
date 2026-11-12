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
| `snapPoints` | `number[]` | | fractions of the viewport (`0.4`) or pixels (`320`); the largest sets the panel size |
| `snap` / `onSnap` | `number` / `(i) => void` | `0` | index into `snapPoints`: it opens at the first listed point |
| `size` | `sm` `md` `lg` `full` | `md` | without snap points |
| `title`, `label`, `footer`, `dismissable`, `class` | | | as in Dialog |

## Accessibility

`role="dialog"`, labelled by the title (or `label`); `aria-modal` only when modal. Escape closes the topmost one, focus
moves in and returns to the opener. With snap points the grab handle is a button ("Resize panel") that steps through
them with Enter / Space, so every size is reachable without a pointer. With reduced motion the panel appears at once.

## Composed of

Dialog's frame (focus trap, Escape stack, scroll lock, head / body / foot) inside a Portal layer (`drawer` when modal,
`popover` otherwise); movement through the motion engine (`animate`, transform only).
