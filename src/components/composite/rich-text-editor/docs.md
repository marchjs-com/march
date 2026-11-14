# RichTextEditor

A rich text field whose value is **Markdown**. Write with the toolbar, keyboard shortcuts or Markdown shortcuts
(`# `, `## `, `- `, `1. `, `> `, ```` ``` ````); mention people with `@`, insert emoji with `:`; pasted HTML from
any site or office suite is cleaned through the safe content core (allowlist, no HTML parser — Trusted Types safe).
Undo / redo use an UndoManager history of the editor's own (typing merges into one step).

```tsx
<RichTextEditor bind:value={$notes} mentions={team} placeholder="Write…" />
<RichTextEditor value={md} toolbar={["bold", "italic", "link", "|", "ul", "ol"]} emoji={false} />
<RichTextEditor api={(e) => editor = e} />   // editor.insert("**Hi**"), editor.exec("h2"), editor.undo()
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | Markdown string | `""` | `onChange(md)` on every change |
| `placeholder` | string | — | shown while empty (`aria-placeholder`) |
| `toolbar` | `false` or `ToolName[]` | all tools | `paragraph h2 h3 bold italic strike code link emoji ul ol quote codeblock undo redo`, `"|"` separates |
| `mentions` | `Mention[]` or `(query) => Mention[] \| Promise` | — | `{ id, label, hint?, avatar? }`; stored as `[@Label](mention:id)` |
| `emoji` | boolean or `EmojiEntry[]` | `true` | `:` suggestions (English shortcodes, Turkish keywords): a lone `:` after a space or at a line start lists the common ones at once, typing filters; never inside a word (`10:30`, `http:`). The toolbar's emoji button opens the same list at the caret. `false` hides both |
| `shortcuts` | boolean | `true` | Markdown block shortcuts while typing |
| `history` | UndoStack | own `undoHistory()` | pass `undoStack()` to share the app's history |
| `rows` | number | `6` | minimum height in lines |
| `counter` | boolean | `true` | words · characters under the text |
| `readonly` / `disabled` | boolean | — | |
| `api` | `(api) => void` | — | `focus`, `markdown()`, `setMarkdown`, `insert(md)`, `exec(tool)`, `undo`, `redo`, `history` |
| `hint` | boolean | `true` | the "Type @ to mention, : for emoji" hint in the foot |
| `toolIcons` | `{ [tool]: node }` | built-in glyphs | own icon (node or short text) per toolbar button |
| `labels` | object | `t` texts | `editor`, `toolbar`, `tools: { bold: "…" }`, `link`, `linkAddress`, `linkHelp`, `apply`, `removeLink`, `suggestions`, `noMatches`, `keepTyping`, `hint`, `count(words, characters)` |
| `class` | class | — | on the root (`m-rte`); parts: `m-rte-bar`, `-toolbar`, `-tool`, `-sep`, `-content`, `-foot`, `-hint`, `-count`, `-link`, `-sug` (the rows are OptionList rows: `.m-rte-sug .m-option-list-row`) |

```tsx
<RichTextEditor bind:value={$md} toolbar={["bold", "italic", "link"]} toolIcons={{ bold: "B", italic: "I" }} hint={false}
  labels={{ tools: { bold: "Strong" }, count: (w, c) => `${c} / 500`, linkAddress: "Where should it go?" }} />
```

Shortcuts: Ctrl/⌘ + B, I, E (code), K (link), Shift+X (strike), Shift+7 / 8 (lists), Shift+9 (quote), Alt+0 / 2 / 3
(paragraph, headings), Z / Shift+Z / Y (undo, redo). Enter splits a block (an empty list item leaves the list),
Shift+Enter is a line break, Backspace at the start of a heading / quote / item turns it into a paragraph.

The same core is usable on its own: `parseHtml(html)`, `sanitizeNode(node)`, `normalizeBlocks(root)`,
`isSafeLink(url)` (`dom/sanitize.ts`, `dom/safe.ts`), `markdownNodes(md)` (`dom/markdown.ts`) and `toMarkdown(root)`
(`dom/to-markdown.ts`).

## Accessibility

The writing area is `role="textbox"` with `aria-multiline`, `aria-placeholder`, `aria-readonly` and the field's label
and description. The toolbar is a `role="toolbar"` with one tab stop (← → Home End move, mirrored in RTL); buttons
announce their state with `aria-pressed` and their shortcut with `aria-keyshortcuts`, and never take the selection
away on click. Suggestions are a `listbox` driven from the text (`aria-activedescendant`, ↑ ↓ Enter Tab Esc). The
link panel is a labelled dialog; invalid addresses are flagged (`aria-invalid`) and only http(s), mailto, tel and
relative links are accepted.

## Composed of

EditorFrame (frame, head and foot bars), FormatToolbar (the formatting bar, shared with MarkdownEditor), Popover + Field
+ TextInput (`UrlInput`: the link panel), Popover + OptionList + Avatar (suggestions; the keys stay in the text:
`keysFrom`; the panels follow the caret / the selection through `virtualAnchor`), IconButton; `undoKeys`, UndoManager
(`undoHistory`), the safe content core
(`dom/safe.ts`, `dom/sanitize.ts`, `dom/markdown.ts`, `dom/to-markdown.ts`).
