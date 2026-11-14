# Tooltip

A short hint for the element it wraps. It appears on hover after a short delay and at once on keyboard focus, hides on
leave, blur or Esc, and is linked to the element with `aria-describedby`. The popover engine places it and flips it
when there is no room.

```tsx
<Tooltip text="Copy link" placement="top"><Button icon={link}>Share</Button></Tooltip>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `text` | string / accessor | — | hint text |
| `placement` | Placement | `top` | preferred side |
| `delay` | ms | `300` | hover delay before it shows (focus shows it at once) |
| `disabled` | boolean / accessor | `false` | `true`: it never shows |
| `motion` | `scale` `fade` `none` | `scale` | entrance motion |
| `color` | ColorToken | inverse surface | colour of the bubble |
| `class` | ClassProp | — | extra class on the bubble (`.hm-tooltip`) |

```tsx
<Tooltip text="Saved" color="success" delay={0} motion="fade"><IconButton icon={check} label="Save" /></Tooltip>
<Tooltip text="Copy link" disabled={() => $touch}><Button>Share</Button></Tooltip>
```

## Accessibility

`role="tooltip"` and `aria-describedby` on the wrapped element while shown; keyboard focus shows it, Esc hides it.
It never holds interactive content (use Dropdown for that) and never receives pointer events.
