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
| `toolbar` | boolean | `true` | headings, bold, italic, strike, code, link, lists, task list, quote, code block |
| `syncScroll` | boolean | `true` | split view panes scroll together |
| `split` | 0–1 | `.5` | source pane share |
| `stats` | boolean | `true` | words and reading time |
| `rows`, `placeholder`, `readonly`, `disabled` | | | |

The text edits are pure functions in `md-ops.ts` (`toggleWrap`, `toggleLines`, `insertLink`, `codeBlock`,
`continueList`, `indentLines`, `stats`). On narrow containers the split view stacks the preview under the source.

## Accessibility

The views are a `tablist` (← → Home End, mirrored in RTL) controlling one `tabpanel`; the source is a labelled
textarea; the preview is a focusable `region` named "Preview"; the split handle is a `separator` with ← → keys. Tab
moves focus as usual except on list lines, where it indents (Shift+Tab outdents). Toolbar buttons keep the text
selection and name their action.

## Composed of

Splitter, Toolbar, IconButton, RichTextEditor (rich view, lazy); `markdownNodes` from the safe content core.
