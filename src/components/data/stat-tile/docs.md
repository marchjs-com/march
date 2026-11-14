# StatTile

One value with its label: the numbers of a profile, an item of a stats band, a figure above a list. The value is text
or a node (a Counter that rolls), a hint line is optional, and the tile becomes a button with `onClick` or a link with
`href`. For a KPI box with a delta and a sparkline use the `StatTile` of `hadi-march/charts`.

```tsx
<StatTile value="128" label="Posts" />
<StatTile value={<Counter value={$followers} mode="roll" />} label="Followers" variant="tile" onClick={openFollowers} />
<StatTile value="$4,250" label="This month" hint="12% more than last month" align="start" size="lg" color="success" />
<dl><StatTile term value="42" label="Events" /></dl>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` | text / number / node / accessor | — | the figure |
| `label` | text / node | — | what it counts |
| `hint` | text / node | — | a small line under them |
| `color` | color token | — | colour of the value (and the hover of a clickable stat) |
| `align` | `start` `center` `end` | `center` | |
| `size` | `sm` `md` `lg` `xl` | `md` | |
| `variant` | `plain` `tile` `card` | `plain` | soft background, or border and surface |
| `order` | `value` `label` | `value` | which line comes first |
| `onClick` | function | — | makes it a button |
| `href` | string | — | makes it a link |
| `disabled` | boolean | `false` | |
| `term` | boolean | `false` | `<dt>` + `<dd>` for a `<dl>` parent (static stats only) |
| `hintIn` | `tile` `value` | `tile` | `value`: the hint sits inside the value element (with `term`: one `<dd>` per term) |
| `emphasis` | `figure` `text` | `figure` | `text`: the value reads as body text that wraps (a details list: KeyValue) |
| `partClass` | `{ value, label, hint }` | — | an extra class on a part (a host that keeps its own class names) |
| `class` | class | — | |
| other attributes | | | `data-*`, `aria-*`, `title`, `id` go to the root |

## Accessibility

A static stat is plain text read in order: value, label, hint (with `term`: the label as the term, then the value). A
clickable one is a real `<button>` or `<a>` whose name is that text; it has a focus ring and `disabled` takes it out
of the tab order. Long labels are cut with an ellipsis; keep them short.

## Composed of

—
