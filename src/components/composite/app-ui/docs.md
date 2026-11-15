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

| Prop | Type | Default | |
|---|---|---|---|
| `title` | string | — | text at the start of the top bar |
| `tools` | node | — | your items in the top bar, before the Layout menu |
| `side` | node | — | beside the workspace at the start (an ActivityBar) |
| `status` | node | — | under the workspace (a StatusBar) |
| `bar` | boolean | `true` | the top bar; without it open the menu yourself (`api.layoutMenu()` gives its items) |
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
and `mode` take signals to keep the choices.

```tsx
<AppPreview theme={$theme} toolbar={{ theme: true, accent: true }} tools={<Button size="sm">Yenile</Button>}>
  <MyComponent />
</AppPreview>
```

## Suggestions for March code

`marchLanguagePlugin({ catalog })` gives the code editor suggestions that know March's exports: after `import` every
component and function (picking one writes `import { Button } from "hadi-march/ui"`), inside `{ … }` the names of the
subpath after `from`, after `from "` the subpaths, after `<` the components, elsewhere the names already imported.
`catalog` is `{ subpaths: [{ subpath, items: [[name, kind, summary]] }] }` (the API reference's index) or a function
that fetches it.

## TypeScript

`typeScriptPlugin({ worker, typescript, lib })` runs the TypeScript language service in a worker: suggestions for the
whole JavaScript / TypeScript / DOM API (after the March plugin's own), and every script file's errors and warnings
underlined in the code editor (red, amber) and counted under it with the first one's line. The app serves three things:
`ts-worker.js` (from this folder), the typescript package's `lib/typescript.js` and its `lib/lib.*.d.ts` files (read on
demand from `lib`). Under a CSP with Trusted Types the worker starts through the `march-worker` policy (same-origin `.js`
only): the CSP must list `trusted-types march-worker`.

## Accessibility

The Layout menu is a Menu (a menu button, arrow keys among the entries, Escape closes); the workspace is a DockLayout.

## Composed of

DockLayout (the workspace), Menu (the Layout menu), CodeEditor (the code editor plugin) and ThemeMenu (the preview's theme).
