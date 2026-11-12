# Loader

A loading state that fills an area: a large spinner with a line of text under it (or only for screen readers). Inline it takes the place of the content; with `overlay` it covers its positioned container with a translucent scrim. `bootLoader.done()` fades out the static `#hm-boot` screen of `index.html` once the app has rendered.

```tsx
<Loader text="Preparing dashboards…" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `text` | `string` / accessor | | visible text; without it "Loading" is read to screen readers only |
| `overlay` | `boolean` | `false` | covers the nearest positioned container |
| `class` | class value | | |

`bootLoader.done({ id = "hm-boot", fade = 250 })` returns false when there is no boot element.

## Accessibility

`role="status"` with `aria-live="polite"`: the text is announced once. The spinner is decorative (`aria-hidden`).
The fade-in waits a moment, so a fast load never flashes a spinner.

## Composed of

Spinner's look (its stylesheet), not the Spinner component: the status is the Loader itself.
