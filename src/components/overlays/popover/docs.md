# Popover

A trigger and a floating panel next to it: filters, a column picker, a link form, a date panel, a list of choices.
The panel is placed beside the trigger (and flips at the screen edge), closes on a press outside or Escape, takes
focus when it opens and gives it back to the trigger. The open state is its own or yours.

```tsx
<Popover trigger={<Button icon={filter}>Filters</Button>} title="Filters" placement="bottom-end"
  footer={<Button size="sm" variant="primary" onClick={apply}>Apply</Button>}>
  {(close) => <FilterForm onDone={close} />}
</Popover>
<Popover trigger="Sort" flush>{(close) => <OptionList bind:value={$sort} options={sorts} onPick={() => close()} />}</Popover>
<Popover bind:open={$open} anchor={() => input} role="listbox" flush autoFocus={false} motion="none">
  <OptionList keysFrom={() => input} options={$suggestions} onPick={insert} />
</Popover>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `trigger` | node / text / `(api) => node` | — | a node gets the click and the ARIA; text becomes a Button; a function wires itself (`api.toggle()`) |
| `anchor` | element / accessor | the trigger | place the panel by this element (a field, a caret rectangle) |
| `open` / `bind:open` | signal / boolean / accessor | own state | controlled open state |
| `defaultOpen` | boolean | `false` | own state: open at first |
| `onOpenChange` | `(open, why) => void` | — | why: `trigger` `outside` `escape` `close` `api` |
| `placement` | `bottom-start` `bottom` `bottom-end` `top-start` `top` `top-end` | `bottom-start` | flips when there is no room |
| `title` | node / accessor | — | a small header (PanelHeader) |
| `closable` | boolean | `true` with a title | the close button in the header |
| `closeLabel` | string | "Close" | |
| `label` | string | — | accessible name when there is no title |
| `role` | `dialog` `menu` `listbox` `tooltip` / null | `dialog` | role of the panel |
| `motion` | `scale` `fade` `rise` `none` | `scale` | entrance |
| `width` | `auto` `sm` `md` `lg` | `auto` | |
| `flush` | boolean | `false` | no padding (a list that fills the panel) |
| `footer` | node | — | under the content |
| `closeOnOutside` | boolean | `true` | |
| `closeOnEscape` | boolean | `true` | |
| `autoFocus` | boolean | `true` | focus the first control (`data-autofocus` wins) when it opens |
| `color` | color token | the trigger's | theme colour inside the panel |
| `class` | class value | — | the wrapper around the trigger |
| `panelClass` | string | — | the floating panel |
| `id` | string | generated | id of the panel (your own trigger's `aria-controls`) |
| `panelProps` | attributes | — | more attributes and listeners of the panel (`onKeydown`, `ref`): Menu's arrow keys |
| `children` | node / `(close, api) => node` | — | the content; `close(true)` also returns focus |

## PopoverPanel

`PopoverPanel` is the floating panel alone, hung on the `anchor` you give (the props of Popover without `trigger` and
`class`): no wrapper element is left in the page. Menu, Dropdown and ContextMenu open their panel with it.

## Accessibility

The trigger gets `aria-haspopup`, `aria-expanded` and `aria-controls`. The panel is a `dialog` (or the `role` you
give) named by its title or `label`; it is not modal: the page stays reachable. Opening moves focus to the first
control in the panel (or the panel); Escape and the close button return it to the trigger; a press outside closes
without moving focus. Escape is taken before a dialog underneath sees it. The panel lives in the popover layer
(Portal), keeps the theme and colour of its trigger, and shows without animation under reduced motion.

## Composed of

PanelHeader (title bar, footer), Button (a text trigger), `floating()` (march/ui popover) and the dismiss behavior.
