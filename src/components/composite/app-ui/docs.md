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
| `class` | class value | — | on the root (`m-app`) |

## Accessibility

The Layout menu is a Menu (a menu button, arrow keys among the entries, Escape closes); the workspace is a DockLayout.

## Composed of

DockLayout (the workspace) and Menu (the Layout menu).
