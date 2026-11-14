# VerifiedMark

The verified-account badge shown beside a name: a post author, a profile title, a user row. It is an image with an
accessible name; the icon, the text, the colour and the size can be changed.

```tsx
<b>{user.name}</b> {user.verified && <VerifiedMark />}
<VerifiedMark size="md" label="Verified organiser" m:color="brand-green" />
<VerifiedMark icon={shieldCheck} label={false} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `label` | string / `false` | "Verified" | accessible name; `false` makes the badge decorative |
| `icon` | icon / text / node | badge with a tick | own mark |
| `m:color` | color token | brand blue | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `size` | `sm` `md` `lg` | `sm` | `sm` beside body text, `md` beside a heading |
| `class` | class | — | |
| other attributes | | | `data-*`, `title`, `id` go to the mark |

## Accessibility

`role="img"` with the label as its name, so the name is read as "Deniz Kaya, Verified". With `label={false}` the badge
is `aria-hidden`; use that only when the text beside it already says the account is verified.

## Composed of

—
