# EditorFrame

The frame of an editor: a border with a focus ring around a head bar (toolbar, search, tabs, status), the editing area
and a foot bar (counts, hints). MarkdownEditor, RichTextEditor and TreeEditor are drawn in it; an editor of your own
gets the same look.

```tsx
<EditorFrame head={<FormatToolbar onTool={exec} />} actions={<Badge>{$words} words</Badge>} foot={<span>Markdown</span>}>
  <textarea class="hm-editor-area" bind:value={$text} />
</EditorFrame>
<EditorFrame showHead={() => $tools.length > 0} headProps={{ sticky: true }} footProps={{ divider: true }} color="brand-green" />
```

`hm-editor-area` is a ready class for a plain editing area inside the frame (a textarea, a contenteditable): no border
of its own, the frame shows the focus.

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `head` | node / accessor | — | content of the head bar |
| `actions` | node / accessor | — | end side of the head bar |
| `showHead` | boolean / accessor | when `head` or `actions` is given | `false` hides the head bar |
| `headProps` | PanelHeader props | `{ size: "sm", tone: "muted", divider: true }` | `sticky`, `class`, `aria-*` … of the head bar |
| `foot` | node / accessor | — | content of the foot bar |
| `showFoot` | boolean / accessor | when `foot` is given | `false` hides the foot bar |
| `footProps` | PanelHeader props | `{ size: "sm" }` | `divider`, `class`, `actions`, `aria-live` … of the foot bar |
| `disabled` | boolean / accessor | `false` | dims the frame (`is-disabled`) |
| `readonly` | boolean / accessor | `false` | marks the frame `is-readonly` |
| `ring` | boolean | `true` | focus ring around the frame |
| `color` | color token | accent | colour of the ring and of the marks inside |
| `class` | class | — | |
| `children` | nodes | — | the editing area |
| other attributes | | | `style`, `data-*`, `id`, `ref`, listeners go to the frame |

## Accessibility

The frame is a plain container: the role and the name belong to the editing area inside it (a textbox, a tree). The
ring appears while anything inside has focus, so the keyboard user sees which editor is active; `ring={false}` leaves
the focus mark to the area itself. The bars are PanelHeaders; give a toolbar inside them its own name.

## Composed of

PanelHeader (head and foot bars).
