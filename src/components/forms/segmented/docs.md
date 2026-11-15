# Segmented

A compact single choice: joined buttons, the chosen one raised. Use it for 2–6 short options (view modes, units,
periods). Arrow keys move and select; only the chosen button is in the Tab order.

```tsx
<Segmented bind:value={$view} options={[{ value: "list", label: "List" }, { value: "grid", label: "Grid" }]} aria-label="View" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | option value | `null` | |
| `options` | `[value]` or `[{ value, label, icon, title, disabled }]` | — | `icon`: before the text; `title`: a tooltip (why it is disabled); `label: ""` with an icon: an icon-only segment named by `title` |
| `indicator` | `"fill"` `"slide"` | `"fill"` | `"slide"`: one thumb glides to the chosen segment |
| `m:color` | ColorToken | — | Common prop (march/props): the colour token of the component and everything in it. |
| `disabled`, `readonly` | boolean | — | |
| `class`, `color`, `id`, `name`, `disabled`, `readonly`, `required`, `invalid`, `aria-label` | | — | the props every control takes; `color` is a theme token |

```tsx
<Segmented bind:value={$theme} indicator="slide" aria-label="Theme" options={[
  { value: "light", label: "Light", icon: sun }, { value: "dark", label: "Dark", icon: moon },
  { value: "system", label: "", icon: monitor, title: "Follow the system" },
]} />
```

## Accessibility

`role="radiogroup"` of `role="radio"` buttons with `aria-checked`; roving tabindex with ← → (mirrored in RTL),
Home and End through the shared focus helper.

## Composed of

Nothing: buttons with roving focus (ui/focus.ts); the `slide` thumb is moved by the shared sliding indicator
(motion/engine/parts.ts).
