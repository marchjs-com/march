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
| `doneIcon` | icon / string / `false` | check | mark of a done step; `false` keeps the number (or the step's icon) |
| `renderDot` | `(i, state, step) => node` | — | your own dot content; `state` is `done`, `current` or `todo` |
| `connector` | boolean | `true` | the line between the steps |
| `class` | ClassProp | — | extra class on the list |

```tsx
<Steps steps={steps} current={$step} doneIcon={false} connector={false} />                 // numbers stay, no line
<Steps steps={steps} current={$step} renderDot={(i, state) => (state === "done" ? "★" : i + 1)} />
```

## Accessibility

An ordered list; the current step has `aria-current="step"`; with `onSelect` each step is a native button.

## Composed of

No other component.
