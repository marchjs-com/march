# MultiSelect

Several values as chips in one field. It is a Combobox with `multiple`: the same static options or async search, the
same keyboard; Backspace in the empty field removes the last chip and each chip has its own remove button.

```tsx
<Field label="Languages"><MultiSelect bind:value={$langs} options={[{ value: "tr", label: "Turkish" }, { value: "en", label: "English" }]} /></Field>
```

## Props

Same as Combobox; the value is an array.

## Accessibility

The listbox is `aria-multiselectable`; each chip's remove button is named "Remove Turkish"; long chip labels scroll
with OverflowText instead of wrapping.

## Composed of

Combobox (with `multiple`).
