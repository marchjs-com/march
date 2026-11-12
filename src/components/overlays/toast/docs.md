# Toast

Short messages that do not block: `toast(message, { kind, action, timeout })` shows one at the inline end of the bottom edge and returns its id. An action (Undo) is a button inside it; a failing action shows its own error toast. At most five stay on screen. A `<ToastHost />` is mounted on first use when the app has none.

```tsx
toast("File archived", { kind: "success", action: { label: "Undo", run: () => restore() } });
```

## Props

| Option | Type | Default | |
|---|---|---|---|
| `kind` | `info` `success` `warn` `danger` | `info` | icon and colour |
| `action` | `{ label, run }` | | a button; the toast closes first |
| `timeout` | ms | 4000; 8000 with an action or for danger | `0`: stays until dismissed |

`toast.dismiss(id)`, `toast.clear()`, `toast.list()` (reactive). `<ToastHost />` renders the stack where you place it
(optional).

## Accessibility

The stack is a polite live region: a new toast is read once; danger toasts are `role="alert"`. Each has a "Dismiss"
button (translated) and the action button, both reachable with Tab; the toast does not take focus. On narrow screens
the stack spans the width.

## Composed of

Portal (the toast layer).
