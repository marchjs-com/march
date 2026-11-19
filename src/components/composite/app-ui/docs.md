# AppUI

march-app-ui, the core of March IDE and the base of an IDE shell: a top bar (a title, your tools and the **Layout**
menu), a side slot (an ActivityBar), the [DockLayout](#docklayout) workspace and a status slot (a StatusBar). The Layout menu lists the presets, the saved layouts ("Save this layout"), every panel
(checked when it is open; choosing one opens or collapses it), "Open all panels" and "Reset to default". Colours come
from the page's theme and accent. Activity bars, status bars and editors are built on top of it.

```tsx
<AppUI title="march-app-ui" panels={panels} presets={{
  default: { title: "Default", tree: () => row([.24, tabs("files")], [.76, col([.7, tabs("editor")], [.3, tabs("console")])]) },
  code: { title: "Code", tree: () => row([.2, tabs("files", { collapsed: true })], [.8, tabs(["editor", "console"])]) },
}} persist="my-ide" tools={<Button>Run</Button>} />
```

## Props

Every DockLayout prop (`panels`, `presets`, `preset`, `persist`, `storage`, `api`, `onClose`, `actions`, `narrow`…), and:
`panels` may be a signal or a computed list: a file opened later gets its tab (at its `place`), one taken out leaves.

| Prop | Type | Default | |
|---|---|---|---|
| `title` | string / `null` | — | text at the start of the top bar; empty or `null`: none |
| `description` | string / `null` | — | a short note beside the title, quiet, smaller, written as a code comment (`// …`) |
| `descriptionMark` | string | `"//"` | what starts the description; `""` for none |
| `tools` | node | — | your items in the top bar, before the Layout menu |
| `side` | node | — | beside the workspace at the start (an ActivityBar) |
| `status` | node | — | under the workspace (a StatusBar) |
| `bar` | boolean | `true` | the top bar; without it open the menu yourself (`api.layoutMenu()` gives its items) |
| `layoutMenu` | boolean | `true` | the Layout menu button at the end of the top bar; `false` hides it (live) |
| `layoutLabel` | string / `false` | "Layout" | name (tooltip) of the Layout menu button, an icon button; `false`: no button |
| `layoutIcon` | icon | columns | own icon of the Layout menu button |
| `plugins` | `AppPlugin[]` | — | file types, panels, commands and services (below) |
| `kit` | `(kit) => void` | — | the running plugin kit: add or remove plugins later |
| `class` | class value | — | on the root (`m-app`) |

## Plugins and files

A panel can show a **file** instead of `content`: `{ id, title, file: { path, text: () => string, set?(text) } }`. The
file type that opens its path draws it (a plugin may come later: the panel is drawn again then); without one it is plain
text. `codeEditorPlugin()` opens code files (.ts, .tsx, .js, .jsx, .css, .html, .json, .sh) in a CodeEditor; a
language service plugin can give its suggestions (the `language` service: `complete(path, ctx)`).
Its options: `save(file)` (Ctrl+S), `match` (the paths it opens), `problems(path, list, text)` (a file's TypeScript
errors and warnings changed; empty when it has none or its editor closed: an app's Problems panel),
`openProblems(path)` (the problem count under the code becomes a button) and `goTo(path)` (reactive: where to put a
file's caret, a new `{ from, to? }` each time: a problem picked from a list). Lines with a problem get a red / amber
icon in the gutter.

```tsx
const myPlugin = definePlugin({
  id: "my.tools", requires: ["march.code"],
  activate(ctx) {
    ctx.command({ id: "my.run", title: "Run", shortcut: "mod+enter", run: () => run() });
    ctx.fileType({ id: "md", match: /\.md$/, mount: (file) => <Markdown text={file.text} /> });
    ctx.panel({ id: "my.log", title: "Log", content: () => <Log /> });
    ctx.provide("runner", { run });
  },
})
<AppUI panels={panels} plugins={[codeEditorPlugin(), myPlugin]} />
```

A plugin's context: `fileType`, `panel`, `command` (the command manager: the palette finds it), `provide` / `service`,
`on` / `emit` (events between plugins) and `onDispose`; each returns a remover, and everything a plugin added goes away
with it. `requires` starts it after the plugins it needs; removing one removes the plugins that need it first.

## Preview

`AppPreview` is the preview panel of an IDE shell: a toolbar (your `tools` at the start; the preview's own color
theme, accent and light / dark at the end: only the preview takes them) over a stage that shows the children in its
middle. Every picker is off until asked for (`toolbar={{ theme: true, mode: true }}`, or `toolbar` for all of them): a
picker added later stays hidden. The bar shows only while at least one picker (or your `tools`) does. `theme`, `accent`
and `mode` take signals to keep the choices; `footer` sits under the stage (the shown component's code); the bar, the
stage and the footer are one piece (Joined). The theme picker's first entry is "Page theme" (the default: `""`, the page's
theme). `toolbar={{ device: true }}` adds a device picker (DevicePicker in a popover: dozens of phones, tablets and desktop
screens, search, portrait / landscape, your own devices): the stage shows its content in DevicePreview — a phone or
tablet body or a desktop window at its real size, fitted to the stage — with its control rail (fingers and gestures,
shake, tilt, offline, battery, background, keyboard); `device` / `rotate` signals keep the choice, `devices` replaces
the list. `toolbar={{ network: true }}` adds the network speed (NetworkThrottle in a popover; the button names the
network and glows while it is limited): the preview's fetch / XHR / module loads come at that speed. When the preview
shares the page with its tool (MarchIDE), `scope` (a CallScope over the call stack) limits the device values and the
network speed to the preview's code; the page keeps its own. `toolbar={{ fullscreen: true }}` adds a full-screen button: the preview alone fills the screen (the footer steps aside), Esc or the button brings it back; where the browser refuses full screen (an embedded view) the preview covers the page instead; with a mouse the toolbar floats over the top and slides away after a moment, the pointer at the top edge (or the keyboard inside it) brings it back, touch screens keep it in place. `toolbar={{ language: true }}` adds a language menu: `languages` (`[{ value, label }]`, `""` the default texts)
and `language` (a signal) keep the choice; what it means for the stage is the owner's (the playground translates the
drawn texts).

```tsx
<AppPreview theme={$theme} toolbar={{ theme: true, accent: true }} tools={<Button size="sm">Yenile</Button>}>
  <MyComponent />
</AppPreview>
```

## Suggestions for March code

`marchLanguagePlugin({ catalog })` gives the code editor suggestions that know March's exports: after `import` every
component and function (picking one writes `import { Button } from "march/ui"`), inside `{ … }` the names of the
subpath after `from`, after `from "` the subpaths, after `<` the components, elsewhere the names already imported and
then every other export (from two letters; picking one writes its import at the top). The code editor shows March's
rows first, then TypeScript's, one row per name, with chips under the list: March (default), TS, JS, All; the choice
is kept across visits. While typing the list stays closed: the likeliest row shows faintly after the caret (`suggest="ghost"`, same case first) and Tab writes it; Ctrl + Space opens the list.
`catalog` is `{ subpaths: [{ subpath, items: [[name, kind, summary]] }] }` (the API reference's index) or a function
that fetches it.

## TypeScript

`typeScriptPlugin({ worker, typescript, lib })` runs the TypeScript language service in a worker: suggestions for the
whole JavaScript / TypeScript / DOM API (after the March plugin's own), and every script file's errors and warnings
underlined in the code editor (red, amber) and counted under it with the first one's line. The app serves three things:
`ts-worker.js` (from this folder), the typescript package's `lib/typescript.js` and its `lib/lib.*.d.ts` files (read on
demand from `lib`). Under a CSP with Trusted Types the worker starts through the `march-worker` policy (same-origin `.js`
only): the CSP must list `trusted-types march-worker`. Every `march` import is `any` to it; `env` gives it real
declarations, fetched once before its first answer (`env: async () => ({ "/march-icons.d.ts": 'declare module "march/icons" { … }' })`:
MarchIDE declares march/icons that way, so `import type { IconType }` is a type and a wrong icon name is an error).

The service also answers the code editor's `describe` (a suggestion's kind, signature and documentation, under the list)
and `signature` (inside a call: the signature with the parameter being written lit); the rows say their kind (method,
getter, setter, function…) in the page's language, and March's rows bring the API reference's summary.

`view: (path, text) => ({ text, inserts })` lets the service read what the host builds instead of the file as typed
(a playground that turns top-level elements into exports): `inserts` are the places text was added (`[at, length]` in
the file's text), and problems, suggestions and hovers are mapped back to the file.

## Debugger

`debuggerPlugin({ run, reveal, evaluate, untrack, persist })` (after HADİ Studio Kit's debugger, rewritten on March) adds
the "Debugger" panel (the Debugger component), a gutter to every script file's editor (line numbers; click one or press
F9 for a breakpoint; the paused line is lit) and the commands F5 (start), Shift+F5 (stop), F8 (continue), F10 (step
over), F11 (step into), Shift+F11 (step out). The host builds and runs the code: while `kit.service("debugger").active()`
it passes its files through `prepare(files)` — the TypeScript plugin's worker loads `instrument.js` (serve it beside
`ts-worker.js`) and writes one-line calls into each script (before every statement, around every function; `debugger;`
becomes a stop; no line moves) and the session starts for them — then runs what comes back; `run` asks it to build
again (start, restart, stop). The code is not halted (a page cannot freeze itself and stay usable): every step is
recorded with the names in scope and the call stack, and the debugger stops on the recording — Continue, the steps and
Step back move through it, and when it has no further stop it waits for the code to reach one. Conditions, logpoint
messages, watches and the host's terminal evaluate with `evaluate(expr, scope)` (the playground: its preview runtime's
module evaluator, no eval); `untrack` is the untrack of the March that runs the code, so reading a value never
subscribes to it.

```tsx
const debug = debuggerPlugin({ persist: "ide.debug", run: () => build(), reveal: (file) => openTab(file), evaluate: (e, scope) => preview.evaluate(e, scope) })
<AppUI plugins={[typeScriptPlugin({ worker, typescript, lib }), debug, codeEditorPlugin()]} … />
// in build(): if (dbg.active()) files = await dbg.prepare(files)
```

## Accessibility

The Layout menu is a Menu (a menu button, arrow keys among the entries, Escape closes); the workspace is a DockLayout.

## Composed of

DockLayout (the workspace), Menu (the Layout menu), CodeEditor (the code editor plugin), ThemeMenu (the preview's theme)
and Debugger (the debugger plugin).
