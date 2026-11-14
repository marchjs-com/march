# Overlay

A decorative layer that lives inside its container: an image, a muted looping video that plays only while visible, an inline SVG, a canvas drawn by a function every frame, or a CSS effect (`glass`, `gradient`, `mesh`, `noise`, `vignette`, `spotlight`, `grid`, `dots`). Layers stack in the order they are added; `front` puts one above the content. They never take pointer input.

```tsx
<section class="hero"><Overlay src="media/waves.webm" poster="media/waves.jpg" /><Overlay effect="vignette" /><h1>Title</h1></section>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `src` | `string` / accessor | | image or video (from the extension, or `type`) |
| `type` | `image` `video` `svg` | | |
| `poster` | `string` | | video; shown instead on save-data or reduced motion |
| `alt` | `string` | | meaningful image; without it the layer is hidden from screen readers |
| `svg` | node | | inline SVG |
| `draw` / `animate` | `(ctx, info) => void` / `boolean` | | canvas drawing; every frame while visible |
| `effect` | see above | | CSS effect |
| `m:color` | colour token | the theme's | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `fit`, `position` | object-fit, object-position | `cover`, `center` | |
| `inset`, `top`, `bottom`, `start`, `end`, `left`, `right` | space step or CSS length | `0` | `start` / `end` follow the text direction |
| `opacity`, `blend` | `number`, mix-blend-mode | `1`, `normal` | |
| `front` | `boolean` | `false` | above the content |
| `layer` | `number` | insertion order | |
| `interactive` | `boolean` | `false` | let it take pointer input |
| `class` | class value | | |

```tsx
<Overlay effect="spotlight" color="brand-orange" />
<Overlay effect="dots" color="brand-purple" opacity={0.6} />
```

`quietMedia()` is true on save-data, 2G or reduced motion.

## Accessibility

Decorative by default: `aria-hidden`, inert, no pointer events (clicks reach the content underneath). Video and
canvas pause off screen and stay still with reduced motion; the canvas loop runs on the motion engine's clock
("pause all" and the global speed reach it). Position and size are CSS variables set through CSSOM (CSP safe).

## Composed of

Nothing: video and canvas code load as their own chunk when used.
