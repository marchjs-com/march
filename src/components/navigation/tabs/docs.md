# Tabs

Tabbed panels. Give `tabs` as data or write `<Tab>` children; only the active panel exists (switching disposes the old
one). Arrow keys move between tabs with automatic activation, mirrored in RTL. Tabs can carry a count badge, be
disabled or hidden, and `query="tab"` keeps the active tab in the URL (`?tab=id`) so a reload or a shared link opens it.

```tsx
<Tabs value={$tab} onChange={(id) => $tab = id} tabs={[
  { id: "general", label: "General", content: () => <General /> },
  { id: "members", label: "Members", badge: () => $pending, content: () => <Members /> },
]} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `tabs` | `TabSpec[]` / accessor | — | `{ id, label, icon?, badge?, dirty?, closable?, title?, disabled?, hidden?, content? }`; or `<Tab>` children |
| `value` | string / accessor | first tab | controlled active id (`bind:value` works) |
| `onChange` / `setValue` | `(id) => void` | — | called when a tab is chosen |
| `query` | string | — | keep the active tab in this URL query parameter |
| `label` | string | — | accessible name of the tab list |
| `panel` | boolean | `true` | `false` draws only the tab bar (the panel lives elsewhere) |
| `variant` | `"line"` `"pill"` | `"line"` | `"pill"`: a rounded switch, the active tab raised |
| `actions` | node | — | content at the end of the tab bar (buttons, a menu); outside the tab list |
| `onClose` | `(id) => void` | — | called by the close mark of a `closable` tab and by the Delete key; you remove the tab |
| `closeIcon` | icon / short text | × | your own close mark |
| `labels` | `{ close?, dirty? }` | "Close", "unsaved changes" | tooltip of the close mark, accessible name of the "changed" dot |
| `activation` | `"auto"` `"manual"` | `"auto"` | `"manual"`: the arrow keys only move focus, Enter / Space select |
| `tabProps` | `(tab) => attrs` | — | extra attributes and events of a tab button (`onPointerdown` to drag it, `onContextmenu`, `class`) |
| `m:color` | ColorToken | theme primary | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `indicator` | boolean | `true` | the underline of the active tab |
| `motion` | `"none"` `"fade"` `"rise"` `"slide"` / `(panel, dir) => void` | the panel rises in once | `"none"`: no motion; the named ones play on every switch (`slide` comes from the side of the new tab); a function gets the panel element and the direction (`1` later tab, `-1` earlier) |
| `class` | ClassProp | — | extra class on the root |

```tsx
<Tabs tabs={tabs} motion="slide" indicator={false} />
<Tabs tabs={tabs} motion={(panel, dir) => animate(panel, [{ opacity: 0, transform: `translateX(${dir * 40}px)` }, { opacity: 1, transform: "none" }], { duration: 300 })} />
```

A tab can carry an icon, the "changed" dot and a close mark; `actions` sits at the end of the bar:

```tsx
<Tabs variant="pill" onClose={(id) => close(id)} actions={<IconButton icon={plus} label="New file" onClick={add} />} tabs={[
  { id: "a", label: "index.ts", icon: code, dirty: () => $changed, closable: true, content: () => <Editor /> },
  { id: "b", label: "Preview", icon: eye, disabled: () => !$ok, title: () => ($ok ? null : "Fix the errors first") },
]} />
```

`TabList` is the strip alone (the same tabs, roving focus and selection, no panel), for a strip that drives something
else: `<TabList tabs={views} value={$view} onSelect={(id) => $view = id} orientation="vertical" activation="manual" />`.
It also takes `tabId`, `controls` (the id of the panel), `wrap(button, tab)` (e.g. a Tooltip around each tab) and
`variant="none"` (no look: your own classes through `tabProps`).

## Accessibility

`role="tablist"` with `role="tab"` buttons (`aria-selected`, `aria-controls`) and one `role="tabpanel"` labelled by the
active tab. Only the active tab is a Tab stop; ← → Home End move and activate (mirrored in RTL). Disabled tabs are
skipped. A closable tab is closed with Delete (`aria-keyshortcuts`); its close mark is a pointer shortcut hidden from
assistive technology, and the "changed" dot has an accessible name. `actions` stay outside the tab list. Reduced
motion: the panel switches without motion.

## Composed of

Badge (tab counts), StatusDot (the "changed" dot); the roving focus helper, `motionPreset` for the panel motion. `Tabs` is `TabList` plus the panel.
