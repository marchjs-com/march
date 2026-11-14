# Picture

The image element behind every "cover", "logo" or "media" slot. Such a slot takes a picture object
(`{ src, alt, width, height, srcset, sizes }`) or a ready node; Picture draws the object as an `<img>` (lazy, decoded
off the main thread, with its size so nothing jumps) and returns a node as it is. `isPicture(x)` tells the two apart.

```tsx
<Picture source={project.cover} fit="cover" />
<Picture src="/hero.jpg" alt="Hills at dusk" width={1200} height={800} loading="eager" />
<Picture source={<MyChart />} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `source` | picture object / node | | the object fills the props below; a node is returned as it is |
| `src` | `string` / accessor | | |
| `alt` | `string` / accessor | `""` | empty: decorative |
| `width`, `height` | `number` | | reserve the space (no layout shift) |
| `srcset`, `sizes` | `string` | | responsive sources |
| `loading` | `lazy` `eager` | `lazy` | `eager`: no lazy loading and `fetchpriority="high"` (first screen) |
| `fit` | `cover` `contain` | | fill the parent's box; default: natural size, never wider than the box |
| `fallback` | text / node | | replaces the image when it fails to load |
| `onLoad`, `onError` | function | | |
| `class` | class value | | |

Other attributes (`draggable`, `id`, `data-*`…) pass to the image. For video, audio or a preview dialog use Media.

## Accessibility

`alt` is always written: the text of the picture, or empty for decoration. The fallback keeps the alternative text as
its accessible name. Width and height keep the layout still while the image loads.

## Composed of

—
