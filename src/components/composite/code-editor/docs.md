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
| `hint` | node / `false` | Ctrl Space + "suggestions" | end of the foot line (shown with `complete`) |
| `copy` | boolean | `true` | the copy button |
| `copyLabel` | string / accessor | "Copy" | its text |
| `label` | string / accessor | "Code" | accessible name of the field |
| `suggestionsLabel` | string / accessor | "Suggestions" | accessible name of the list |
| `multiline` | boolean | `true` | `false`: Enter does not write a new line |
| `readonly`, `disabled` | boolean | `false` | |
| `color` | color token | accent | focus ring, selection and flash |
| `onBlur` | `(e) => void` | — | focus left the field (tidy the code here) |
| `inputRef` | `(textarea) => void` | — | the text field |
| `id`, `name`, `class` | | | |

A suggestion: `{ label, hint?, insert?, back?, again? }`: `insert` replaces the word being written (default: the
label), `back` moves the caret back into what was inserted (`variant=""` → inside the quotes), `again` asks for
suggestions right after the pick (the values of the prop just written).

## Accessibility

The field is a native `<textarea>` with a name (`label`), described by the foot line (a polite live region: a new
message is read). The coloured copy is hidden from assistive technology. With the list open the field keeps focus:
it gets `aria-controls` / `aria-activedescendant`, ↑ ↓ move, Enter or Tab pick, Escape closes; Ctrl + Space opens
it. Without the list Tab leaves the field as usual (it is never a focus trap). The flash runs on the motion engine
and is skipped with reduced motion.

## Composed of

EditorFrame (border, focus ring, foot bar), Popover + OptionList (the suggestions; list-nav keys from the field),
CopyButton, Kbd (the shortcut hint), StatusDot (the status). Colours come from `tokenize` (the CodeView highlighter).
