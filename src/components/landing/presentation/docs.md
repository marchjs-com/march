# Presentation

Slides in the browser. `<Presentation>` holds `<Slide>`s; `<Appear>` reveals its children one per step. Arrow keys,
Page Up / Down, Space, Home / End, the wheel (full screen), swipes and the buttons move through it; `F` goes full screen
and `P` opens the speaker window. Slides change with a slide, fade or zoom transition (mirrored in RTL). The slide number
can live in the URL. The speaker view shows the current and next slide, the notes and a timer, and every window of the
same deck stays in step. Printing (or saving as PDF) puts each slide on its own page with all steps visible.

```tsx
let $slide = Number(queryParam("slide")() ?? 0)
<Presentation bind:index={$slide} transition="slide" presenterUrl="#/talk?presenter=1">
  <Slide layout="title" tone="brand" notes="Welcome everyone">…</Slide>
  <Slide notes="Three points, one by one"><h2>Why?</h2><Appear><li>Fast</li><li>Accessible</li><li>Beautiful</li></Appear></Slide>
</Presentation>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `index`, `setIndex` | number | `0` | current slide; `bind:index` to keep it in the URL |
| `transition` | `slide` `fade` `zoom` `none` | `slide` | |
| `presenter` | boolean | `false` | speaker view (next slide, notes, timer) |
| `sync` | string or `false` | `deck` | windows with the same name stay in step (cross-tab channel) |
| `presenterUrl` | string | — | the speaker button / `P` opens it in a new window |
| `label` | string | `Presentation` | accessible name |

`<Slide layout="title|content|split|center|image" tone="plain|inverse|brand" notes="…" background={<Overlay …/>}>`,
`<Appear as="ul|ol|div" effect="up|fade|scale">` (each child is a step).

## Accessibility

The deck is a focusable region ("slide deck"); only the current slide is exposed (others are inert and hidden), the
counter "Slide 3 of 12" is announced, buttons are labelled, the timer has `role="timer"`. Reduced motion changes slides
without movement. Type scales with the stage, so zoom and projectors keep the layout.

## Composed of

IconButton; motion engine, `swipe`, `channel` (cross-tab).
