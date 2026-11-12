# Spacer

A flexible gap in a row: everything after it moves to the end of the row (the logical end, so it mirrors in RTL). The
usual way to put a title on one side of a top bar and its actions on the other.

```tsx
<Stack direction="row" align="center"><Brand /><Spacer /><UserMenu /></Stack>
```

## Props

None.

## Accessibility

Decorative: `aria-hidden="true"`.

## Composed of

No other component.
