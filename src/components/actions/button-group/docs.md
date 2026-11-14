# ButtonGroup

Related buttons side by side: spaced (the default) or `attached` into one strip whose outer ends are rounded. The group
has `role="group"` and a label, so screen readers announce what the buttons belong to.

```tsx
<ButtonGroup attached label="Alignment">
  <Button>Start</Button><Button>Center</Button><Button>End</Button>
</ButtonGroup>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `label` | string / accessor | — | accessible name of the group |
| `attached` | boolean | `false` | one strip, no gaps |
| `class` | class | — | extra classes on the group |
| `children` | nodes | — | the buttons |

## Accessibility

`role="group"` with `aria-label`. For a single choice among options use Segmented (a radio group) instead. The attached
strip uses logical corner radii, so in RTL the rounded ends stay on the outside.
