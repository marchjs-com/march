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
| `closeButton` | boolean / icon / node | `true` | the × in the head; `false`: no × (Escape and the scrim still close); or your own icon |
| `closeLabel` | `string` | "Close" | accessible name of the × |
| `motion` | `scale` `fade` `rise` `none` | `scale` | entrance of the panel (`none`: the scrim appears at once too) |
| `class` | `string` | | |

```tsx
<Dialog open={$open} onClose={close} title="Invite" closeButton={false} motion="fade">…</Dialog>
<Dialog open={$open} onClose={close} title="Invite" closeButton={arrowLeft} closeLabel="Back to the list">…</Dialog>
```

`openDialog(render, { title, size, footer, dismissable, dismissValue, closeButton, closeLabel, motion })`, `openDrawer(render, { side: "left" | "right" | "bottom", … })`,
`confirm("Delete it?")` or `confirm({ title, message, danger, ok, cancel })` → `boolean`, `prompt({ title, label, value, placeholder, validate, multiline, ok, cancel })` → `string | null`,
`askReason({ title, min, purposes, ok, cancel, labels, counter })` → the text (or `{ category, text }`) or `null`.

Every text of the ready-made dialogs is yours: `ok` and `cancel` name the buttons; `askReason` also takes
`labels: { reason, purpose, choose, choosePurpose, tooShort: (min) => string }` (field labels, the empty choice and the
two error messages) and `counter: false` (no character counter). All three take `dialog: { size, class, target,
closeButton, closeLabel, motion }` for the look of the dialog itself:

```tsx
await prompt({ title: "New name", ok: "Rename", cancel: "Keep the old one", dialog: { motion: "rise", closeButton: false } });
await askReason({ min: 20, counter: false, labels: { reason: "Why?", tooShort: (n) => `At least ${n} characters, please.` } });
```

## Accessibility

`role="dialog"` (alertdialog for confirm), `aria-modal`, labelled by the title. Focus moves into the dialog, Tab stays
inside, Escape closes the topmost one (a popover inside closes first), focus returns to the opener. The page behind
is scroll-locked. On phones the panel rises from the bottom edge; drawers mirror in right-to-left layouts.

`openDrawer()` (and `openDialog(render, { kind: "drawer", side })`) opens the `<Drawer>` component: one drawer, with its
grab handle, drag to close and logical sides. Its module is loaded when the first one opens.

## Composed of

Portal (the dialog layer), PanelHeader (the head with the title and the ×, and the foot bar), IconButton (the ×),
Button (the buttons of confirm / prompt / askReason), Field with TextInput / Textarea (prompt, the reason) and Select
(the purposes of askReason), Drawer (openDrawer).
