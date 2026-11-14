# Menu

A trigger button with a floating menu. Items are plain entries (`label`, `icon`, `onSelect`, `href`, `shortcut`,
`danger`, `disabled`, `hidden`, `can`), `action()` objects (their guard, confirmation and toasts come along) or
separators (`"-"`). `args` are passed to every action and `onSelect`.

`Dropdown` is the same trigger with any floating content; its children may be a function of `close`.

```tsx
<Menu label="Actions" icon={more} items={[{ label: "Edit", icon: edit, shortcut: "E", onSelect: edit }, "-", remove]} args={[row]} />
<Dropdown label="Filters">{(close) => <FilterForm onDone={close} />}</Dropdown>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `MenuItem[]` / accessor | — | Menu entries |
| `args` | array / accessor | — | passed to actions and `onSelect` |
| `label` | string / accessor | — | trigger text and accessible name |
| `icon` | icon | — | icon-only trigger |
| `trigger` | node | — | custom trigger content |
| `variant` / `size` | Button variants / sizes | `secondary` / `md` | trigger look |
| `color` | color token | theme primary | accent of the trigger (primary fill, icon trigger) |
| `class` | class | — | extra classes on the trigger |
| `placement` | Placement | `bottom-start` | panel side (flips when there is no room) |
| `panelClass` | string | — | class on the panel |
| `disabled` | boolean / accessor | — | |
| `children` | node / `(close) => node` | — | Dropdown: the panel content |

Every part of the trigger is yours: `trigger` replaces its content, `icon` and `label` are optional, and an item draws
an icon, a shortcut or a separator only when you give one.

```tsx
<Menu label="Actions" variant="primary" color="brand-purple" trigger={<><Avatar name={user.name} /> {user.name}</>} items={items} />
```

## Accessibility

The trigger has `aria-haspopup`, `aria-expanded` and `aria-controls`. ↓ / ↑ on the trigger opens on the first / last
item; ↑ ↓ Home End move (roving focus), Enter activates, Esc closes and returns focus to the trigger, Tab leaves.
Items are `role="menuitem"`; shortcuts are shown with Kbd styling and the platform's modifier names.
