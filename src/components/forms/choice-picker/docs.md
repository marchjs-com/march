# ChoicePicker

One single-choice control that picks its look from the options, so option panels never show a drop-down for a handful
of values. With `kind: "auto"`: 10 or more options → Combobox; options with a `preview` → preview cards; 2–6 short
labels → Segmented; otherwise chips. Any other `kind` forces that look; `pickerKind(options)` tells which one auto picks.

```tsx
<ChoicePicker bind:value={$align} options={["start", "center", "end"]} />           // segmented
<ChoicePicker bind:value={$blend} options={modes.map((m) => ({ value: m, label: m, preview: () => <Swatch mode={m} /> }))} kind="grid" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | option value | `null` | |
| `options` | `[value]` or `[{ value, label, hint?, disabled?, preview? }]` | — | |
| `kind` | `auto` `segmented` `chips` `cards` `grid` `combobox` | `auto` | |

## Accessibility

Whatever look it takes, it is that component's pattern: a radiogroup (segmented, chips, cards) or a combobox; the look
is rebuilt only when the options or the kind change, never on a value change, so focus is kept.

## Composed of

Segmented, RadioGroup (chips and cards) and Combobox.
