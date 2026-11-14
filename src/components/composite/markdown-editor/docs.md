# MarkdownEditor

Markdown source with a live preview. Four views: **write**, **preview**, **split** (resizable; both panes scroll
together) and **rich** (the same value in a RichTextEditor, loaded the first time it is opened). The toolbar and
shortcuts write Markdown syntax as native undo steps (Ctrl+Z keeps working); Enter continues lists and quotes, Tab /
Shift+Tab indent list lines; HTML pasted from a web page or an office suite becomes Markdown through the safe content
core.

```tsx
<MarkdownEditor bind:value={$doc} view="split" />
<MarkdownEditor value={md} views={["write", "preview"]} toolbar={false} />
<MarkdownEditor bind:value={$doc} view="rich" stats={false} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | string | `""` | Markdown |
| `view` | `write` `preview` `split` `rich` | `write` | first view |
| `views` | `MarkdownView[]` | all four | tabs offered, in order; one hides the switcher |
| `preview` | `tab` `split` | — | older form of `view` |
| `toolbar` | boolean / `(MarkdownTool \| "\|")[]` | `true` | headings, bold, italic, strike, code, link, lists, task list, quote, code block; a list shows only those tools, in that order (`"\|"` is a separator) |
| `icons` | `{ [tool]: icon }` | — | own icon for a tool (an icon, a string or a node) |
| `hint` | boolean | `true` | the Markdown syntax reminder in the footer |
| `labels` | object | — | own texts: `write`, `preview`, `split`, `rich`, `view`, `formatting`, `tools: { bold: "…" }`, `source`, `resize`, `hint`, `words(count)`, `minutes(count)` |
| `syncScroll` | boolean | `true` | split view panes scroll together |
| `split` | 0–1 | `.5` | source pane share |
| `stats` | boolean | `true` | words and reading time |
| `rows`, `placeholder`, `readonly`, `disabled` | | | |
| `class` | class value | — | on the root (`hm-mde`) |

```tsx
<MarkdownEditor bind:value={$md} toolbar={["bold", "italic", "|", "link"]} hint={false}
  labels={{ write: "Draft", preview: "Read", tools: { bold: "Strong" }, words: (n) => `${n} w` }} />
```

The text edits are pure functions in `md-ops.ts` (`toggleWrap`, `toggleLines`, `insertLink`, `codeBlock`,
`continueList`, `indentLines`, `stats`). On narrow containers the split view stacks the preview under the source.

## Accessibility

The views are a `tablist` (← → Home End, mirrored in RTL) controlling one `tabpanel`; the source is a labelled
textarea; the preview is a focusable `region` named "Preview"; the split handle is a `separator` with ← → keys. Tab
moves focus as usual except on list lines, where it indents (Shift+Tab outdents). The toolbar is a `role="toolbar"` with one tab
stop (arrow keys, Home and End move between the buttons, mirrored in RTL); its buttons keep the text selection, name
their action and announce their shortcut (`aria-keyshortcuts`).

## Composed of

EditorFrame (frame, head and foot bars), FormatToolbar (the formatting bar, shared with RichTextEditor), Tabs (the view
switcher: `TabList`, `variant="pill"`), Splitter, RichTextEditor (rich view, lazy); `markdownNodes` from the safe
content core.
