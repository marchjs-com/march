# Steps

Progress through stages. Done steps show a check, the current step is highlighted and marked for screen readers, the
rest are upcoming. With `onSelect` every step is a button (a checkout that lets you go back); `vertical` stacks them
with their descriptions. Stepper and Wizard are built on it.

```tsx
<Steps steps={[{ title: "Account" }, { title: "Profile" }, { title: "Done" }]} current={$step} onSelect={(i) => $step = i} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `steps` | `StepItem[]` | — | `{ title, description?, icon? }` |
| `current` | number / accessor | — | current step (0-based) |
| `onSelect` | `(i) => void` | — | makes each step a button |
| `vertical` | boolean | `false` | vertical list |
| `color` | ColorToken | theme primary | accent of done and current steps |

## Accessibility

An ordered list; the current step has `aria-current="step"`; with `onSelect` each step is a native button.

## Composed of

No other component.
