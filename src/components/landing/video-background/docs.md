# VideoBackground

A muted, looping video behind content (a hero, a CTA band, a slide). Built on Overlay: the poster shows first and stays
on save-data, 2G and reduced motion; the video plays only while it is visible and is released when it leaves the page.
A tint keeps text readable and a small button pauses the motion.

```tsx
<VideoBackground src="/media/clip.webm" poster="/media/clip.jpg" tint="dark">
  <h1>…</h1>
</VideoBackground>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `src` | string | — | mp4 / webm |
| `poster` | string | — | first frame, and the fallback |
| `tint` | `dark` `light` `brand` `none` | `dark` | readability layer (text colour follows) |
| `tintOpacity` | 0–1 | `.45` | |
| `position` | string | `center` | object-position |
| `controls` | boolean | `true` | pause / play button |
| `icons` | `{ play?, pause? }` | built-in | own icons of that button |
| `labels` | `{ play?, pause? }` | `Play background video` `Pause background video` | its accessible names |
| `class` | class | — | on the root |

```tsx
<VideoBackground src="/clip.webm" poster="/clip.jpg" labels={{ pause: "Stop the waves", play: "Start the waves" }} icons={{ pause: square }} />
```

## Accessibility

The video is decorative (hidden from screen readers, never focusable). Moving content longer than five seconds needs a
way to stop it: the pause button (labelled "Pause background video") does that. Reduced motion shows the poster only.

## Composed of

Overlay (video, poster, vignette), IconButton; icons `play`, `pause`.
