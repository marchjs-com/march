# CheckMark

The yes / no / partly mark of comparison tables, plan features and check lists: ✓, ✕ or – together with the text a
screen reader reads. The text is visually hidden unless `text` shows it; every glyph and text can be replaced.

```tsx
<CheckMark value={row.included} />
<CheckMark value="partial" text />
<CheckMark value={false} variant="soft" label={false} />
<CheckMark value labels={{ yes: "Included" }} icons={{ yes: heart }} color="primary" size="lg" />
<CheckMark value={$done} variant="soft" motion="flip" />          // ✕ turns into ✓ when $done changes
<CheckMark value={$ok} motion={(next, prev) => animate(next, { opacity: [0, 1], transform: ["translateY(6px)", "none"] }, { duration: 240 }).finished} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` | `true` `false` `"partial"` / accessor | `true` | ✓, ✕ or – |
| `labels` | `{ yes, no, partial }` | Yes / No / Partly | text per value |
| `label` | string / `false` | — | text for the current value; `false`: no text, the mark is decorative |
| `text` | boolean | `false` | show the text beside the mark |
| `icons` | `{ yes, no, partial }` | check / x / minus | own glyph per value (icon, text or node); `false` draws none |
| `variant` | `plain` `soft` `solid` | `plain` | the glyph alone, on a tinted disc or on a filled disc |
| `size` | `sm` `md` `lg` | `md` | |
| `color` | color token | by value | success / danger / warn unless a token is given |
| `motion` | `flip` `fade` `pop` `draw` / `none` `false` / `(next, prev, change) => …` | `none` | the transition when the value changes: the glyphs turn into each other (`flip`), cross-fade, pop, or the new stroke is drawn; your own function gets the arriving and the leaving glyph and `{ from, to }` (return a promise: the leaving glyph is removed when it settles). Runs on the motion engine; with reduced motion the glyph changes at once |
| `class` | class | — | |
| other attributes | | | `data-*`, `title`, `id` go to the root |

## Accessibility

The glyph is hidden from assistive technology; the text ("Yes", "No", "Partly", or yours) is what is read, so the
meaning never rests on colour or shape alone. With `label={false}` the whole mark is `aria-hidden`: use that only when
the text around it already says the same (a "not included" note, a checkbox row).

## Composed of

—
