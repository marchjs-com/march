# ExplodedView

Takes what it holds apart, like an exploded drawing, and puts it back. Nothing is drawn again: the **same** elements
tilt and rise (their state, focus and listeners stay), so what comes apart is exactly what was on screen.

- With `parts` (selectors inside the content) every matching element rises as a plate with a name tag: the
  components a card is built from.
- Without `parts` one element (the first, or `target`) opens into its layers: shadow, surface, content, focus ring.
  The shadow, surface and ring plates are plain boxes that copy the element's computed look.

```tsx
import { ExplodedView } from "hadi-march/ui";

<ExplodedView bind:open={$apart} onPick={(id) => $picked = id} active={$picked}
  parts={[{ selector: ".m-avatar", label: "Avatar" }, { selector: ".m-like", label: "LikeButton", level: 2 }]}>
  <PostCard post={post} />
</ExplodedView>
<ExplodedView open={$apart}><Button icon={plus}>New project</Button></ExplodedView>     // the layers of the button
<ExplodedView open layers={{ ring: false, surface: "Background" }} gap={32} tilt={{ x: 46, z: -24 }} motion="spring" tags={false} fit={false} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `open` / `bind:open` | boolean / signal / accessor | `false` | apart or together |
| `parts` | `{ selector, label?, id?, level? }[]` / accessor | — | the plates; `level`: steps above the plate it sits on (1) |
| `target` | selector / accessor | first element | layers mode: the element taken apart |
| `layers` | `{ shadow?, surface?, content?, ring? }` | Shadow, Surface, Content, Focus ring | a name per layer, or `false` to leave it out |
| `tags` | boolean / accessor | `true` | the name tags |
| `gap` | number / accessor | `26` | px between two plates |
| `tilt` | `{ x?, z? }` | `{ x: 52, z: -30 }` | degrees; `z` is mirrored in RTL |
| `fit` | number / `false` | `420` | apart, the content is scaled so its longer side is at most this |
| `motion` | `smooth` `spring` `none` / `false` | `smooth` | |
| `onPick` | `(id, el) => void` | — | a plate was pressed while apart (`id`: the part's id / label, or `shadow` `surface` `content` `ring`) |
| `active` | id / accessor | — | the plate shown as chosen |
| `m:color` | color token | accent | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `label` | string / accessor | "Exploded view" | accessible name of the group while apart |
| `class` | class | — | |

While apart the content does not take presses: a press picks the plate under it (`onPick`). The marks are
`data-m-xv` attributes, present only while apart and on the way back; when the content is drawn again or resized
while apart, the plates are found and measured again.

## Accessibility

Together, the view adds nothing: the content is as accessible as it was. Apart, it is a `group` with a name; the
ghost plates and the tags are hidden from assistive technology (they repeat what the content says). Keyboard focus
stays in the content. The movement is CSS transitions of `transform` / `translate`: reduced motion makes it instant.

## Composed of

No other component: a box, transforms and the `translate` property. Sizes come from `observeSize` (ui/observe).
