# BottomNav

The mobile tab bar: a colored bubble slides to the active tab, tabs carry count or dot badges, and an optional raised Create button in the middle wears a slowly turning ring of the four HADİ colors (Heyecan, Aktivite, Dostluk, İletişim).

```tsx
<BottomNav items={tabs} value={$tab} onChange={(id) => $tab = id} onCreate={compose} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `{ id, label, icon?, activeIcon?, badge?, dot?, color?, href? }[]` | | `badge`: count (0 hides, 120 → "99+"); `href`: a link |
| `value` / `onChange` | `string` / `(id) => void` | | active tab |
| `onCreate` | `() => void` | | shows the Create button in the middle slot |
| `createLabel`, `createIcon` | | "Create", plus | |
| `ring` | CSS colors | the four HADİ colors | ring of the Create button (a theme's brand tokens win) |
| `labels` | `boolean` | `true` | hidden labels stay the accessible name; very narrow bars hide them too |
| `variant` | `floating` `flat` | `floating` | flat runs edge to edge and keeps the safe area |
| `tint` | `brand` `accent` | `brand` | brand: each tab's own color (the four HADİ colors in turn) |
| `label`, `class` | | "Main" | landmark name |

## Accessibility

A `nav` landmark; each tab is a button (or a link with `href`) named by its label, the active one has
`aria-current="page"`. Badges carry their count as text. The Create button is a labelled button. Tab order follows
the bar, focus rings stay inside it. With reduced motion the bubble jumps, the icon does not pop and the ring stays
still. In right-to-left layouts the order mirrors.

## Composed of

Badge (count and dot), OverflowText (long labels scroll instead of overflowing), the motion engine (bubble FLIP,
icon pop, ring turn).
