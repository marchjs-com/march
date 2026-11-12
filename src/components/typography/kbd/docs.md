# Kbd

A keyboard key. Give it text (`<Kbd>Esc</Kbd>`) or a shortcut string: `keys="mod+k"` is written for the platform
(⌘K on macOS, Ctrl+K elsewhere), the same way `key()` and the shortcut list read it.

```tsx
<Kbd keys="mod+k" />
<Kbd keys="shift+enter" />
<Kbd>Esc</Kbd>
```

## Props

| Prop | Type | |
|---|---|---|
| `keys` | string / accessor | shortcut (`mod`, `shift`, `alt`, `ctrl` + key), formatted with `formatKey` |
| `children` | node | plain key text when `keys` is not given |

## Accessibility

A real `<kbd>` element: screen readers announce it as keyboard input.
