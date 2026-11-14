# UI (`hadi-march/ui`)

Accessible components, dialogs, toasts, navigation, a command palette and keyboard shortcuts. Load the styles once:

```js
import "hadi-march/css/tokens.css"
import "hadi-march/css/ui.css"
```

Every component uses the design tokens (light/dark), never inline styles (popover positions use CSSOM style objects, which
CSP allows), and inserts text as text nodes. User-facing default strings go through ``t`…` `` so apps can translate them.
Props may be values, signals or accessors; JSX props are live. `hadi-march/ui` also re-exports the forms module.

## Actions

`action(label, fn, opts)` describes a command once; buttons, menus, table bulk actions and the palette render the same object.

| opt | meaning |
|---|---|
| `confirm` | `true`, text, or `(...args) => text`: ask before running |
| `danger` | red styling, always confirms |
| `reason` | number (min length) or `{ min, title }`: asks with `askReason`, the reason is appended to the args |
| `undo` | `(result, ...args) => …`: success toast gets an Undo button |
| `can` | permission (see `can()` in access); hidden when not allowed |
| `key`, `icon`, `success`, `hidden(...args)`, `disabled(...args)`, `id`, `group`, `keywords` | |

```jsx
const remove = action("Delete", (row) => api.remove(row.id), { danger: true, confirm: (row) => `Delete ${row.name}?`, can: "users.delete", success: "Deleted" })
<ActionButton action={remove} args={[row]} />
```

## Buttons

| Component | Props |
|---|---|
| `Button` | `variant` (primary, secondary, ghost, danger), `size` (sm, md, lg), `loading`, `disabled`, `icon`, `iconEnd`, `block`, `href` (renders a router `Link`), `type`, any attribute/event |
| `IconButton` | `icon`, `label` (required: aria-label + title), `variant`, `size` |
| `ActionButton` | `action`, `args` (array or `() => array`), `variant`, `size`, `icon`, `iconOnly`, `onDone(result)`, `onError(e)`; hidden when not allowed, busy while running |
| `ButtonGroup` | `label`, `attached` |
| `Menu` | `items` (`{ label, onSelect, icon, href, danger, disabled, hidden, can, shortcut }`, actions, or `"-"`), `args`, `label`, `icon`, `trigger`, `variant`, `placement` |
| `Dropdown` | `label`/`trigger`/`icon`, children or `(close) => content` |
| `Tooltip` | `text`, `placement` (top, bottom, …-start/-end); wraps one element |
| `CopyButton` | `text` (value or accessor), `label`, `iconOnly`, `onCopy` |

```jsx
<Button variant="primary" loading={$saving} on:click={save}>Save</Button>
<Menu label="Row actions" icon="⋯" items={[edit, remove, "-", { label: "Open", href: `/users/${row.id}` }]} args={[row]} />
<Tooltip text="Copy the link"><CopyButton text={link} iconOnly /></Tooltip>
```

Menu keyboard: ↓/↑ on the trigger opens; ↑ ↓ Home End move; Enter activates; Esc closes and returns focus; Tab leaves.

## Dialogs

All dialogs trap Tab, close on Esc and (when `dismissable`, the default) on an overlay click, set `aria-modal`, stack
(Esc closes only the top one) and restore focus to the element that opened them.

| Function | Resolves |
|---|---|
| `confirm({ title, message, danger, ok, cancel })` | `true` / `false` |
| `prompt({ title, message, label, value, placeholder, validate, ok, multiline })` | string / `null`; `validate(v)` returns an error or null |
| `askReason({ title, message, min = 10, danger, ok, purposes })` | string / `null`; with `purposes: [{ value, label }]` → `{ category, text }` / `null` |
| `openDialog((close) => content, { title, size: "sm"\|"md"\|"lg"\|"full", dismissable, footer: (close) => nodes })` | value passed to `close(v)` (undefined when dismissed) |
| `openDrawer(render, { side: "right"\|"left"\|"bottom", … })` | same as openDialog |
| `closeAll()`, `openDialogs()` | |

Declarative: `<Dialog open onClose title size footer dismissable>` and `<Drawer open onClose side title>`.

```jsx
if (await confirm({ title: "Delete user?", message: user.name, danger: true })) await api.remove(user.id)
const why = await askReason({ title: "Open personal data", purposes: [{ value: "support", label: "Support request" }] })
<Drawer open={$filters} onClose={() => $filters = false} title="Filters"><FilterForm /></Drawer>
```

## Toasts

`toast(message, { kind: "info"|"success"|"warn"|"danger", action: { label, run }, timeout })` returns an id;
`toast.dismiss(id)`, `toast.clear()`. Default timeout 4 s (8 s with an action or for danger; `0` keeps it).
`<ToastHost />` (aria-live polite) is mounted automatically on first use if the app did not render one.

```jsx
toast("Saved", { kind: "success", action: { label: "Undo", run: restore } })
```

## Tabs

`<Tabs tabs={[{ id, label, badge, disabled, hidden, content: () => node }]} query="tab" value onChange label />`, or
children `<Tab id label badge>…</Tab>`. ← → Home End move and activate. `query` keeps the active tab in the URL (`?tab=id`,
via `setQuery`). Only the active panel exists in the DOM.

```jsx
<Tabs query="tab" tabs={[{ id: "profile", label: "Profile", content: () => <Profile /> }, { id: "log", label: "Log", badge: () => $unread, content: () => <Log /> }]} />
```

## Display

| Component | Props |
|---|---|
| `Card` | `title`, `subtitle`, `actions` (actions or nodes), `footer`, `flush`, `as` |
| `Badge` | `tone` (neutral, info, success, warn, danger), `dot`; count variant: `count`, `max = 99` (→ "99+"), `showZero`, `label` |
| `Empty` | `icon`, `title`, children (text), `action` |
| `Spinner` | `size` (sm, md, lg), `label` |
| `ErrorBox` | `error` or `message`, `title`, `retry` |
| `Skeleton` | `lines = 3`, or `block` with `height` (sm, md, lg) |
| `Alert` / `Notice` | `tone`, `title`, `body` or children, `icon`, `dismissable`, `onDismiss` |
| `Kbd` | children, or `keys="mod+k"` (→ Ctrl+K / ⌘K) |
| `Avatar` | `name` (initials fallback), `src`, `size` |
| `CodeView` | `code`, `lang`, `lineNumbers = true`, `wrap`, `copy = true`, `label` |
| `JsonView` | `value`, `open = 1` (expanded depth) |
| `KeyValue` | `items` (`[{ label, value, hint, hidden }]` or an object), `columns`, `empty` |
| `Timeline` | `items: [{ time, title, body, tone, icon }]` (dates formatted with the `datetime` pipe) |

```jsx
<Card title="Account" actions={[edit]}><KeyValue columns={2} items={{ Email: u.email, Joined: u.created | date }} /></Card>
<Badge tone="success">Active</Badge> <Badge count={$unread} />
<Timeline items={events.map((e) => ({ time: e.at, title: e.type, body: e.note }))} />
```

## Layout

| Component | Props |
|---|---|
| `Stack` | `gap` (0–8), `direction="row"`, `align`, `justify` (start, center, end, between), `wrap`, `as` |
| `Grid` | `cols` (1–6, collapses on small screens) or `min="16rem"` (auto-fill), `gap` |
| `Toolbar` | `label`, `end` (right side), children |
| `Divider` | `label`, `vertical` |
| `Page` | `title`, `subtitle`, `actions`, `breadcrumbs: [{ label, href }]`, `back` (path, `true` = history back, or fn), `tabs`, `tabsQuery`, `narrow` |
| `Section` | `title`, `description`, `actions` |
| `ListDetail` | `list`, `detail` (node or `() => node`), `selected`, `onBack`, `empty`; one pane at a time on narrow screens |
| `Pager` | offset: `page` (1-based), `total`, `size`, `onPage`, `sizes`, `onSize`; cursor: `hasPrev`, `hasNext`, `onPrev`, `onNext` |
| `SearchBox` | `value` / `bind:value`, `onSearch`, `onEnter`, `debounce = 250`, `placeholder`, `label`, `shortcut` (`true` = "/") |

```jsx
<Page title="Users" breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Users" }]} actions={[invite]}>
  <Toolbar end={<Pager page={$page} total={$total} size={20} onPage={(p) => $page = p} />}>
    <SearchBox bind:value={$q} shortcut />
  </Toolbar>
  <ListDetail list={<UserList />} detail={() => <UserDetail id={$id} />} selected={$id} onBack={() => $id = null} />
</Page>
```

## NavMenu

Sidebar for big apps. `items: [{ id, title, href, icon?, group?, badge?: () => number, keywords?, can?, hidden? }]`.

| Prop | Meaning |
|---|---|
| `storageKey = "m.nav"` | localStorage key for collapsed groups, pins and recent items (`{ collapsed, pins, recent }`) |
| `maxPinned = 8`, `maxRecent = 5` | list sizes (0 disables recent) |
| `sort` | `"alpha"` (default: `compareText` with the active locale), `"none"`, or `(a, b) => number`; applies to groups and items |
| `brand`, `footer`, `label`, `filter = true`, `palette = true` (register pages for the command palette) | |

The active item follows the router path (longest matching href). On narrow screens the menu becomes a drawer opened with
the hamburger button; it closes after navigation, on Esc and on the scrim.

```jsx
<NavMenu brand="Admin" storageKey="admin.nav" items={[{ id: "users", title: "Users", href: "/users", group: "People", badge: () => $pending }]} />
```


## NavSidebar

The larger sidebar: title, a search box (Ctrl K), a featured item, recent visits, collapsible categories with counts,
keyboard navigation, icon rail (`collapsible`) and a drawer on small screens.

Resizing (optional): `resizable` adds a grip on the inner edge (logical inline-end, so it is on the left in RTL).
Drag it (mouse, pen or touch), double click it to go back to the starting width, or focus it and use ← → (16 px,
Shift 64 px), Home (narrowest) and End (widest). `role="separator"` with `aria-valuenow/min/max`.

| Prop | Default | |
| --- | --- | --- |
| `width` | `17.5rem` | starting width: px or a CSS length |
| `resizable` | `false` | show the grip |
| `minWidth` / `maxWidth` | `200` / `480` | limits in px |
| `onResize` | | `(px) => …` while resizing |
| `persist` | `true` | remember the width (in `storageKey`), or pass a localStorage key; `false` = forget |
| `collapseBelow` | | px: dragging narrower switches to the icon rail, wider restores the labels |

The width is the `--m-sb-w` CSS variable on the wrapper (set through CSSOM: no inline style attribute, CSP safe).

```jsx
<NavSidebar items={items} resizable width="18rem" minWidth={220} maxWidth={420} collapseBelow={150} />
```

## Command palette

`<CommandPalette ask={…} placeholder shortcut="mod+k" limit={50} commands={[…]} onRun />` — Ctrl/⌘+K toggles it,
`openPalette()` / `closePalette()` / `paletteOpen()` control it (a default palette is mounted if none is rendered).
It searches `registerCommands([{ id, title, run, href, group, keywords, icon, shortcut, hidden, can } | action])`, NavMenu
pages (`registerPages`) and actions. Ranking folds accents and Turkish ı/İ, prefers title prefixes, then word starts,
substrings, initials/abbreviations, then typo matches (Damerau-Levenshtein for words of 4+ characters).
`ask(query) → Promise<{ results: [{ id, reason }] }>` adds an "Ask" row (Enter runs it; it also runs by itself 600 ms after
typing when local results are weak) and shows the returned ids as suggestions. Keys: ↑ ↓ PageUp PageDown Enter Esc.

```jsx
registerCommands([{ id: "new-user", title: "Create user", keywords: "add member", run: () => navigate("/users/new") }])
<CommandPalette ask={(q) => api.intent(q)} />
```

Helpers: `fold(text)`, `distance(a, b, max)`, `score(query, title, keywords)`, `rank(query, items, (x) => ({ title, keywords }))`.

## Keyboard shortcuts

`key(combo, fn, { when, description, inInputs, preventDefault, group })` registers a global shortcut and returns an
unregister function (also called automatically when the owning component is disposed). `mod` is ⌘ on macOS and Ctrl
elsewhere; typing in inputs is ignored unless `inInputs: true`. `shortcuts()` lists described shortcuts (`{ combo, label,
description, group }`) for a help dialog; `formatKey("mod+k")` → "Ctrl+K" / "⌘K".

```jsx
key("mod+s", save, { description: "Save", inInputs: true })
<For each={shortcuts()}>{(s) => <p><Kbd>{s().label}</Kbd> {s().description}</p>}</For>
```

## Loader, theme, locale, updates

- `bootLoader.done()` fades out and removes the static `#m-boot` element of index.html. `<Loader text overlay />` is a full-area spinner.
- `theme()` is `"system" | "light" | "dark"`, persisted in localStorage `m.theme` and applied as `data-theme` on `<html>`;
  `theme.set(v)` / `setTheme(v)`, `resolvedTheme()`. `<ThemeToggle />` cycles the three.
- `<LocaleSelect options={[{ value: "en", label: "English" }, "tr"]} />` is bound to `locale` / `setLocale`.
- `<UpdateBanner url="/build.txt" every={5} text reloadText onReload />` polls the URL (and on tab focus) and offers a
  reload when its text differs from the first response.

```jsx
render(() => <App />, document.getElementById("app")); bootLoader.done()
<Toolbar end={[<LocaleSelect options={["en", "tr"]} />, <ThemeToggle />]} />
<UpdateBanner />
```

## AppShell

Application frame: sidebar + main. Desktop: sticky sidebar column; narrow screens: slim top bar with the NavMenu button (the menu becomes a drawer).

```jsx
<AppShell nav={<NavMenu items={items} />} top={<UpdateBanner url="/build.txt" />}>
  <Router />
</AppShell>
```

Props: `nav`, `top` (optional strip above main), `mainId` (default "main"), `class`.

## Media

`<Media src kind alt poster controls autoplay loop muted size fallback />` (`size`: `"sm"` thumbnail, `"md"`) shows an image, video or audio that fits its
container (`kind`: `"image"` default, `"video"`, `"audio"`, `"auto"` = by file extension via `mediaKind(src)`). URLs go
through `safeUrl` (http(s), relative, `blob:`); a load error shows `fallback` ("Could not load media"). Video/audio have
controls unless `controls={false}`. `openMedia(src, { title, kind, alt, poster, size, autoplay })` opens it in a dialog.

```jsx
<Media src={tpl.previewUrl} kind="video" poster={tpl.thumb} />
<Button onClick={() => openMedia(shotUrl, { title: "Screenshot" })}>Open</Button>
```

## Disclosure

Collapsible section on native `<details>`: `<Disclosure title="Advanced" open={false} onToggle={(o) => …}>…</Disclosure>`.
