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
| `icon` | icon / short text / node / `false` | the kind's icon | your own icon, or none |
| `color` | ColorToken | the kind's colour | colour of the icon |
| `closable` | boolean | `true` | the close (×) button; without it give a timeout, an action, or dismiss it yourself |
| `closeLabel` | string | "Dismiss" | accessible name of the close button |
| `motion` | `spring` `fade` `none` | `spring` | entrance motion |
| `class` | string | — | extra class on the toast |
| `action.error` | string | "Something went wrong." | error toast when `run` fails without a message |

```tsx
toast("Level up!", { icon: "🎉", color: "brand-purple", closable: false, motion: "fade", timeout: 3000 });
toast("Saved", { icon: false, closeLabel: "Close the message" });
```

`toast.dismiss(id)`, `toast.clear()`, `toast.list()` (reactive). `<ToastHost />` renders the stack where you place it
(optional); it takes `position` (`bottom-end` default, `bottom-start`, `bottom-center`, `top-end`, `top-start`,
`top-center`; start / end follow the writing direction) and `class`: `<ToastHost position="top-center" />`.

## Accessibility

The stack is a polite live region: a new toast is read once; danger toasts are `role="alert"`. Each has a "Dismiss"
button (translated) and the action button, both reachable with Tab; the toast does not take focus. On narrow screens
the stack spans the width.

## Composed of

Portal (the toast layer), Alert (a toast is a raised Alert: the tone's icon, the message, the × button), Button (the action).
