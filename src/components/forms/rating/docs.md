# Rating

Stars to give or show a score. Editable it is a radio group: click or use the arrow keys (mirrored in right-to-left layouts), Home / End; hovering previews the score in a lighter tone. Read-only it can show half stars (`4.5`).

```tsx
<Rating bind:value={$stars} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` | `number` / accessor | `0` | read-only values may be fractional |
| `setValue` / `onChange` | `(v) => void` | | `bind:value` sets `setValue` |
| `max` | `number` | `5` | |
| `readonly` | `boolean` | `false` | shows the value, no input |
| `size` | `sm` `md` `lg` | `md` | |
| `m:color` | colour token | the theme's primary | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `label` | `string` / accessor | "Rating" (translated) | |
| `class` | class value | | |
| `icon` | icon or `(n) => node` | star outline | the empty mark |
| `iconOn` | icon or `(n) => node` | filled star (or `icon`) | the filled mark |
| `starLabel` | `(n, max) => string` | "3 of 5" | accessible name of a mark |
| `animate` | boolean | `true` | `false`: no hover growth, no fade |

Hearts instead of stars: `<Rating bind:value={$v} icon={heart} iconOn={heartFilled} color="danger"
starLabel={(n, max) => `${max} üzerinden ${n}`} animate={false} />`; `icon={(n) => <b>{n}</b>}` draws anything.

## Accessibility

`role="radiogroup"` with a label; each star is a radio ("3 of 5", translated) with `aria-checked`, one tab stop (the
current value), arrow keys move and select without wrapping. Read-only stars are disabled buttons, so the value is
still read out.

## Composed of

Nothing; the roving focus behaviour moves between the stars.
