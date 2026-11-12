# Dialog

A modal window over the page. Declarative: `<Dialog open={…} onClose={…}>`; imperative: `openDialog(render)` and `openDrawer(render)` return a promise that resolves with the value passed to `close(value)`. `confirm`, `prompt` and `askReason` are ready-made dialogs; `closeAll()` and `openDialogs()` manage the stack.

```tsx
<Dialog open={$open} onClose={() => $open = false} title="Invite" footer={<Button variant="primary">Send</Button>}>…</Dialog>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `open` | `boolean` / accessor | | shown while true |
| `onClose` | `() => void` | | Escape, the scrim or × (when dismissable) |
| `title` | node | | heading; labels the dialog |
| `label` | `string` | | accessible name without a visible title |
| `size` | `sm` `md` `lg` `full` | `md` | |
| `footer` | node | | bottom bar (buttons) |
| `dismissable` | `boolean` / accessor | `true` | false: only the content closes it |
| `modal` | `boolean` | `true` | false: no scrim lock, the page stays usable |
| `class` | `string` | | |

`openDialog(render, { title, size, footer, dismissable, dismissValue })`, `openDrawer(render, { side: "left" | "right" | "bottom", … })`,
`confirm({ title, message, danger, ok, cancel })` → `boolean`, `prompt({ title, label, value, placeholder, validate, multiline })` → `string | null`,
`askReason({ title, min, purposes })` → the text (or `{ category, text }`) or `null`.

## Accessibility

`role="dialog"` (alertdialog for confirm), `aria-modal`, labelled by the title. Focus moves into the dialog, Tab stays
inside, Escape closes the topmost one (a popover inside closes first), focus returns to the opener. The page behind
is scroll-locked. On phones the panel rises from the bottom edge; drawers mirror in right-to-left layouts.

## Composed of

Portal (the dialog layer).
