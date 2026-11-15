# FormatToolbar

The formatting bar of a text editor: bold, italic, headings, lists, link, undo and redo. MarkdownEditor and
RichTextEditor use it; put it over your own editor and apply the format in `onTool`.

```tsx
<FormatToolbar tools={["bold", "italic", "|", "link"]} onTool={exec} pressed={{ bold: () => $bold }} hints />
<FormatToolbar onTool={exec} labels={{ bold: "Strong" }} icons={{ bold: "B" }} m:color="brand-orange" size="md" />
```

`formatShortcut(event)` gives the tool of a formatting shortcut (mod+B / I / E / K, mod+Shift+X / 7 / 8 / 9), so the
keydown handler of the editor and the bar run the same tools. `formatToolName(tool)` is the translated name of a tool.

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `tools` | list of tools and `"|"` | `FORMAT_TOOLS` | tools in order; `"|"` is a separator. Read once |
| `onTool` | `(tool) => void` | — | runs a tool |
| `label` | string | "Formatting" | accessible name of the bar |
| `labels` | `{ tool: text }` | translated names | own name of a tool |
| `name` | `(tool) => text` | — | own names as a function (wins over `labels`) |
| `icons` | `{ tool: icon / text / node / false }` | built-in icons | own icons; `false` draws none |
| `disabled` | boolean / `(tool) => boolean` | `false` | the whole bar or single tools |
| `pressed` | `{ tool: () => boolean }` | — | toggle tools: `aria-pressed` and the pressed look |
| `keys` | `{ tool: "Control+B" / false }` | `FORMAT_KEYS` | `aria-keyshortcuts` per tool; `false` removes one |
| `hints` | boolean | `false` | the shortcut in the tooltip too: "Bold (Ctrl+B)" |
| `size` | `xs` `sm` `md` | `sm` | size of the buttons |
| `m:color` | color token | accent | Common prop (march/props): the colour token of the component and everything in it. |
| `prefix` | string | — | extra class names for a host: `<prefix>-toolbar`, `-tool`, `-sep`, `-tool-own` |
| `attrs` | `(tool) => attributes` | — | extra attributes of a tool button (`aria-haspopup`, `ref`, `class`) |
| `class` | class | — | |

Tools: `paragraph` `h2` `h3` `bold` `italic` `strike` `code` `link` `emoji` `ul` `ol` `task` `quote` `codeblock`
`undo` `redo`.

## Accessibility

`role="toolbar"` with a name; one Tab stop, the arrow keys, Home and End move between the tools (swapped in
right-to-left). Every tool is a button with its name as `aria-label` and tooltip, `aria-keyshortcuts` for its
shortcut and `aria-pressed` when it is a toggle. A press on a tool does not take focus, so the text selection of the
editor stays.

## Composed of

Toolbar, IconButton (`pressed`), Divider; behaviors/roving-focus.
