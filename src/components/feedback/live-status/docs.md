# LiveStatus

The line that says what just changed: "3 selected", "21–40 of 120", "Build: 9 – 13 Nov". It is a polite live region,
so screen readers hear the change without focus moving. Shown as text where the number is useful to everyone (a table
footer), or only read (`visible={false}`) where sighted users already see the change (a dragged event). With `help` a
hint line comes before it; give it `helpId` and point the widget at it with `aria-describedby`.

```tsx
<LiveStatus text={() => `${$count} selected`} />
<LiveStatus visible={false} text={$moved} help="Drag an event to move it" helpId="plan-help" />
<section aria-describedby="plan-help">…</section>
```

For a one-off message that has no place on screen ("Saved"), call `announce()` (hadi-march/managers/announcer) instead.

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `text` (or children) | text / node / accessor | | what is said |
| `visible` | boolean | `true` | `false`: visually hidden, still read |
| `politeness` | `polite` `assertive` | `polite` | `assertive` interrupts the reader |
| `as` | `span` `div` `p` | `span` | the element |
| `help` | text / node / accessor / `false` | none | a hint line before the status |
| `helpId` | string | | id of the hint line (`aria-describedby` of the host) |
| `helpClass` | string | | an extra class on the hint line |
| `class` | class value | | on the status element; other attributes (`id`, `data-*`) go there too |

## Accessibility

`role="status"` with `aria-live`: the text is read when it changes, after what the reader is saying (`polite`) or at
once (`assertive`; keep it for errors). The region must be on the page before its text changes, so render it always
and change only the text. A hidden status is clipped, not `display: none`, so it is still read. The hint line is a
plain paragraph: it is read once, when focus enters the widget that points at it.

## Composed of

—
