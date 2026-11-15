# CodeEditor

A small code field for one snippet: the text is coloured while it is typed (the CodeView colours; unfinished code
too), a suggestion list opens at the caret, ranges can be marked (a flash for "this just changed", an underline for
"this is wrong") and a foot line says what the owner thinks of the code. It does **not** run or compile anything:
the owner reads `value` and decides what it means (the showcase reads a component's props from it).

```tsx
import { CodeEditor, jsxCompleter } from "hadi-march/ui";

<CodeEditor bind:value={$code} lang="tsx" message={$note} status={$bad ? "error" : "ok"}
  complete={jsxCompleter({ tag: "Button", props: [
    { name: "variant", hint: "look", values: ["primary", "secondary", "ghost"] },   // variant="…": values inside the quotes
    { name: "icon", hint: "icon", value: "={plus}" },                              // written as icon={plus}
    { name: "disabled" },                                                          // a bare prop
  ] })}
  marks={[{ from: 8, to: 23, kind: "flash" }]} />
<CodeEditor value={$css} onChange={save} lang="css" complete={(ctx) => ({ from: ctx.caret, items: [{ label: "color" }] })} />
<CodeEditor bind:value={$one} multiline={false} message={false} copy={false} />   // one bare line
```

`jsxCompleter({ tag, props })` is the ready `complete` for one JSX tag: prop names after a space, while a name is
typed and on Ctrl + Space (names already written are left out); the values of a prop inside its quotes. Your own
`complete(ctx)` returns `{ from, to?, items }`: the rows and the range of text a picked row replaces.

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | string / signal / accessor | `""` | the code |
| `onChange` | `(code) => void` | — | every edit |
| `lang` | string | `"tsx"` | colours: js / ts / jsx / tsx, css, html, json, sh; `""` none |
| `complete` | `(ctx) => { from, to?, items } \| null` | — | suggestions for the caret's place; `ctx`: `{ value, caret, before, forced, typed }` |
| `marks` | `{ from, to, kind? }[]` / accessor | — | marked ranges: `flash` (default; glows once) or `error` (underlined) |
| `flash` | `glow` `none` / `false` | `glow` | how a flash mark shows |
| `message` | text / node / accessor / `false` | — | the foot line; `false`: no foot bar |
| `status` | `ok` `error` / `false` / accessor | `ok` | the dot before the message; `false`: no dot |
| `hint` | node | — | your own node at the end of the foot line |
| `keys` | `false` / `{ [command]: boolean }` | all on | the IDE keys (below); `false`: none, Tab moves the focus |
| `tabSize` | number | `2` | spaces of one indent |
| `onSave` | `(value) => void` | — | Ctrl+S (⌘S); the browser's "save page" does not open |
| `shortcuts` | boolean | `true` | the shortcuts button (a menu of every key) in the foot line |
| `moreShortcuts` | `{ keys, label, group? }[]` / accessor | — | the app's keys, listed under the editor's |
| `shortcutsLabel` | string / accessor | "Keyboard shortcuts" | name of the button and the menu |
| `listAfter` | number | `3` | with `suggest="ghost"`: the list opens too once the word is this long; 0: only on Ctrl+Space / `listOn` |
| `listOn` | string | `"."` | characters that open the list even with `suggest="ghost"` (a member list) |
| `copy` | boolean | `true` | the copy button (an icon button) |
| `copyLabel` | string / accessor | "Copy" | its accessible name and tooltip |
| `label` | string / accessor | "Code" | accessible name of the field |
| `suggestionsLabel` | string / accessor | "Suggestions" | accessible name of the list |
| `suggest` | `list` `ghost` | `list` | while typing: the list opens, or the likeliest row (same case first) is written faintly after the caret and Tab takes it; Ctrl + Space opens the list either way |
| `sources` / `source` / `onSourceChange` | `{ value, label }[]` / string / `(v) => void` | — / the first | chips under the list that filter the rows by their `source` (`"all"`: every row); the owner keeps the choice |
| `multiline` | boolean | `true` | `false`: Enter does not write a new line |
| `readonly`, `disabled` | boolean | `false` | |
| `m:color` | color token | accent | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `onBlur` | `(e) => void` | — | focus left the field (tidy the code here) |
| `inputRef` | `(textarea) => void` | — | the text field |
| `lineNumbers` | boolean / accessor | `false` | a gutter with each line's number (a wrapped line keeps one) |
| `lineMarks` | `{ line, kind?, title? }[]` / accessor | — | marks beside the numbers: `breakpoint` (red dot), `conditional` (amber), `log` (diamond), `off` (hollow); any other kind is a class `is-<kind>` to style |
| `activeLine` | number / `{ line, kind? }` / accessor | — | a line lit across the editor (a debugger's paused line; kinds `current`, `exception`, `frame`), scrolled into view |
| `onGutter` | `(line, e) => void` | — | a press on the gutter, or F9 at the caret's line (toggle a breakpoint) |
| `id`, `name`, `class` | | | |

A suggestion: `{ label, hint?, insert?, back?, again?, source?, head? }`: `insert` replaces the word being written (default: the
label), `back` moves the caret back into what was inserted (`variant=""` → inside the quotes), `again` asks for
suggestions right after the pick (the values of the prop just written), `source` is what the `sources` chips filter
by, `head` a line written at the top of the text with the pick when it is not there yet (the row's import).

## Keys

| Keys | Command (`keys` name) |
|---|---|
| Tab / Shift+Tab | indent / outdent the caret's line or every selected line (`indent`, `outdent`); Tab takes a ghost or picks in the list |
| Enter | new line with the line's indent, one more after `{ ( [`; the closer moves a line down (`newline`) |
| Ctrl+/ | comment / uncomment the lines (`//`, `#` for sh) (`comment`) |
| Alt+↑ / Alt+↓ | move the lines (`moveUp`, `moveDown`) |
| Shift+Alt+↑ / ↓ | copy the lines up / down (`copyUp`, `copyDown`) |
| Ctrl+Shift+K | delete the lines (`deleteLine`) |
| Ctrl+Space | the suggestion list (`suggest`) |
| Ctrl+S | `onSave` (`save`) |
| Esc, then Tab | leave the editor (`release`): Tab is the editor's until Escape |
| F9 | `onGutter` at the caret's line |

Edits go through the browser's own undo (Ctrl+Z). Rows are ranked for the word typed: first the shortest name that
starts with it in the same case (`con` → `console` before `consoleTransport`), then by source in the chips' order
(March first), how well they fit and length; the ghost shows the first row. A row with a `group` is listed under its heading; a completion with
`all: true` shows every row whatever source chip is chosen (a member list after a dot: `console.` → Methods, Properties).

## Accessibility

The field is a native `<textarea>` with a name (`label`), described by the foot line (a polite live region: a new
message is read). The coloured copy is hidden from assistive technology. With the list open the field keeps focus:
it gets `aria-controls` / `aria-activedescendant`, ↑ ↓ move, Enter or Tab pick, Escape closes; Ctrl + Space opens
it. Without the list Tab leaves the field as usual (it is never a focus trap). The flash runs on the motion engine
and is skipped with reduced motion.

## Composed of

EditorFrame (border, focus ring, foot bar), Popover + OptionList (the suggestions; list-nav keys from the field),
CopyButton (icon only), Dropdown + Kbd (the shortcuts menu), StatusDot (the status). Colours come from `tokenize` (the CodeView highlighter).
