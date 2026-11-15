# ProjectDetail

The page of one project: a back button, a big title, the facts (role, client, year, services as chips), the cover —
marked as the shared element, so a ProjectGrid card can grow into it — the story, a gallery that opens in the Lightbox
and the next project.

```tsx
let $open: Project | null = null
const open = (p, cover) => sharedTransition(`project-${p.id}`, cover, () => { $open = p })
<If when={$open}>{(p) => <ProjectDetail project={p} onBack={() => $open = null} next={{ project: nextOf(p), onOpen: open }} />}
<Else><ProjectGrid projects={work} onOpen={open} /></Else></If>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `project` | Project + `{ role?, client?, services?, body?, gallery?, links? }` | — | |
| `onBack` | `() => void` | — | shows the back button |
| `next` | `{ project, onOpen }` | — | next-project card (its cover morphs too) |
| `shared` | string | `project-<id>` | shared element name of the cover (ProjectGrid uses the same) |
| `eyebrow` | boolean | `true` | the category line above the title |
| `facts` | boolean | `true` | the facts list (role, client, year, category) |
| `backIcon` | icon / `false` | arrow | icon of the back button |
| `nextIcon` | icon, node / `false` | arrow | icon after the next project's title |
| `m:color` | color token | accent | Common prop (march/props): the colour token of the component and everything in it. |
| `reveal` | Reveal options / `false` | `{ effect: "up" }` | entrance of the heading and the story |
| `labels` | `{ back?, next?, role?, client?, year?, category?, services?, openImage?(n) }` | built-in texts | any text the page writes itself |
| `class` | class | — | on the article |

```tsx
<ProjectDetail project={p} onBack={back} m:color="brand-orange" reveal={{ effect: "blur" }}
  labels={{ back: "Back to work", next: "Up next", client: "For", openImage: (n) => `Photo ${n}` }} />
<ProjectDetail project={p} facts={false} eyebrow={false} backIcon={false} nextIcon={false} reveal={false} />
```

## Accessibility

An `<article>` with one `<h1>`; the facts are a description list (KeyValue); gallery images are buttons named "Open
image n" that open the Lightbox dialog (focus returns on close). The hero cover loads eagerly with its size reserved.

## Composed of

SectionHead (the heading), Picture, Button, KeyValue, Chip, openMedia (Lightbox), Reveal; `sharedTransition` (march/motion).
