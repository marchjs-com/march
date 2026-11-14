# StoryProgress

The segmented bars on top of a story. Segments before the current one are full, later ones empty, and the current one
fills over its duration on the motion engine. The fill is an essential animation: it keeps time with reduced motion
(the story would otherwise skip at once), while "pause all" and the global speed still apply. `paused` holds the fill
where it is; `onDone` fires when it is full. In RTL the bars fill from the right.

```tsx
<StoryProgress count={items.length} index={$i} run={item.id} paused={$hold} onDone={next} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `count` | number | — | segments |
| `index` | number | — | current segment (0-based) |
| `duration` | ms | 6000 | fill time of the current segment |
| `paused` | boolean | false | hold the fill |
| `run` | any | — | restart the fill when it changes (the story id) |
| `onDone` | `() => void` | — | the current segment is full |
| `label` | `(index, count) => string` | "Story 2 of 5" | your own screen-reader text |
| `color` | ColorToken | white | fill color |
| `class` | string | — | on the root (`hm-story-progress`, a line Progress; parts: `hm-progress2-seg`, `hm-progress2-seg-fill`) |

```tsx
<StoryProgress count={5} index={$i} color="brand-orange" label={(i, n) => `Slide ${i + 1} / ${n}`} />
```

## Accessibility

A `progressbar` named "Stories" whose value is read as the text "Story 2 of 5" (`aria-valuetext`; `aria-valuenow`
counts the finished segments, `aria-valuemax` all of them). The moving fill itself is not announced.

## Composed of

Progress. StoryViewer uses it.
