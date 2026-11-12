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

## Accessibility

An `<article>` with one `<h1>`; the facts are a description list (KeyValue); gallery images are buttons named "Open
image n" that open the Lightbox dialog (focus returns on close). The hero cover loads eagerly with its size reserved.

## Composed of

Button, KeyValue, Chip, openMedia (Lightbox), Reveal; `sharedTransition` (hadi-march/motion).
