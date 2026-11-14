# Disclosure

A collapsible section built on the native `<details>` / `<summary>` elements, so keyboard and screen reader support
come for free and the browser's find-in-page opens it. The summary line has a turning chevron and the body opens with
an animation. `open` can be a signal; `onToggle` reports the new state.

```tsx
<Disclosure title="Advanced settings" open={false} onToggle={(open) => save({ advanced: open })}>
  <AdvancedForm />
</Disclosure>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `title` | node | — | the summary line |
| `open` | boolean / accessor | `false` | open state |
| `onToggle` | `(open) => void` | — | called when the user opens or closes it |
| `children` | node | — | the body |
| `marker` | boolean / node | `true` | the turning arrow before the title: off, or your own mark |
| `class` | class | — | added to the root (`.hm-disclosure`); parts: `.hm-disclosure-summary`, `.hm-disclosure-marker`, `.hm-disclosure-body` |

```tsx
<Disclosure title="Advanced" marker={false}>…</Disclosure>
<Disclosure title="Advanced" marker={<Icon of={settings} />}>…</Disclosure>
```

## Accessibility

Native `<details>` / `<summary>`: a button-like summary with the expanded state announced by the browser; Enter and
Space toggle.

## Composed of

No other component.
