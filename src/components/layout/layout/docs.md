# Layout

The frame the screens of an app share, with changeable behavior. What every page needs lives here once, so pages never
repeat it, and later page-wide features land in one place.

- **Regions**: `top`, `header`, `nav`, `aside`, `footer` around the content (the AppShell frame: sticky sidebar that
  becomes a drawer on narrow screens, sticky header, skip link; below 1100 px the aside becomes a bottom sheet opened from a corner button) and the
  four page corners (`top-start`, `top-end`, `bottom-start`, `bottom-end`, mirrored in RTL).
- **Features**: page-wide behaviors as plug-ins, `(api) => cleanup`. Built in, by name: `scrollToTop`,
  `readingProgress`, `routeFocus`, `autoHideHeader`, `shortcuts` ("?" opens the shortcut list), `consent` (cookie
  banner), `toasts` (a layout-owned toast host), `credit` ("Developed with March and 💗"), `connection` (offline badge),
  `feedback` (a button that asks for a message → `onSubmit`), `devOverlay` (Alt+Shift+L outlines the regions); `defineLayoutFeature(name, make)` adds your own. They load in their
  own chunks after the first paint.
- **Variants**: `defineLayout(defaults)`; `Layout.extend({ … })` derives one (regions override, features merge by name).
  AppShell is `Layout.extend({ framed: true })`.
- **Pages**: `Page` builds on Layout — its `corners`, `features` and `layout` region content join the layout and leave
  with the page; its title goes to the document through `titleTemplate`.

```tsx
import { Layout, defineLayout, defineLayoutFeature, scrollToTopFeature } from "march/layout";

<Layout header={<TopBar/>} nav={<SideNav/>} titleTemplate="%s · HADİ"><Outlet/></Layout>

<Layout features={{ readingProgress: true, scrollToTop: { threshold: 600 }, routeFocus: false }}
        corners={{ "top-end": <Status/> }}>…</Layout>

const DocsLayout = Layout.extend({ aside: <Toc/>, features: { readingProgress: true } })

const help = defineLayoutFeature("help", () => (api) => api.add("bottom-start", <HelpButton/>))
<Layout features={{ help: true }}>…</Layout>

<Page title="Kullanıcılar" layout={{ aside: <Filters/> }} corners={{ "bottom-end": <NewUser/> }}>…</Page>
const SettingsPage = Page.extend({ narrow: true, tabsQuery: "tab" })
```

`useLayout()` gives the surrounding layout: `add(region, node, order)`, `set(slot, content)`, `region(name)`,
`use(feature | name, options)`, `disable(name)`, `features()`, `titleTemplate`.

## Props

| Prop | |
|---|---|
| `top`, `header`, `nav`, `aside`, `footer` | Region content. Any region turns the frame on. |
| `corners` | Content for the page corners, `{ "top-end": node \| node[] }`. |
| `features` | By name (`{ scrollToTop: false, readingProgress: true }`: on, off, options), a list (replaces the defaults) or `(defaults) => list`. Default: `scrollToTop`, `routeFocus`. |
| `titleTemplate` | Document title pattern for pages, `"%s · MarchJS"`. |
| `framed` | Always draw the frame (skip link, main), also without regions. |
| `mainId` | id of the main element (skip-link target), default `main`. |
| `labels` | Texts the frame writes itself: `{ skip, panel }` — the skip link and the button that opens the aside on narrow screens (string or accessor each; the defaults are translated). |
| `skipLink` | `false`: no "Skip to content" link. |
| `asideToggle` | `false`: no corner button for the aside sheet on narrow screens (open it yourself: `data-open` on the aside). |
| `class` | Class of the frame (`.m-layout`); parts: `.m-skip`, `.m-shell-nav`, `.m-shell-top`, `.m-shell-header`, `.m-layout-main`, `.m-layout-aside`, `.m-layout-footer`, `.m-layout-aside-btn`. |

```tsx
<Layout nav={<SideNav/>} aside={<Toc/>} labels={{ skip: "Jump to the article", panel: "Contents" }}>…</Layout>
<Layout header={<TopBar/>} skipLink={false} asideToggle={false}>…</Layout>
```

Options of the built-in features (every text and colour is yours):

| Feature | Options |
|---|---|
| `scrollToTop` | `threshold`, `corner`, `order`, `label` (and the other ScrollToTop props) |
| `readingProgress` | `color` (a color token; any other value is used as a CSS color), `height` (px), `label` |
| `autoHideHeader` | `after` (px scrolled before it hides) |
| `connection` | `corner`, `label` (the offline text) |
| `feedback` | `onSubmit`, `corner`, `label` (button), `title`, `messageLabel` (the dialog), `thanks` (toast text; `false`: no toast) |
| `credit` | `variant`, `corner` |
| `consent` | the texts of ConsentBanner |

```tsx
<Layout features={{ readingProgress: { color: "brand-orange", label: "Article progress" },
                    connection: { label: "No connection" }, feedback: { label: "Ideas?", thanks: false, onSubmit: send } }}>…</Layout>
```

## Accessibility

A skip link to `main` (focusable, `tabindex="-1"`); landmarks `header`, `nav` (aside element), `main`, `aside`,
`footer`; corners are `role="group"` with a translated name. `routeFocus` moves focus to main after a route change and
reads the new title in a polite live region. The reading bar is a `progressbar` that keeps working with reduced motion.

## Composed of

Uses the page corners (`addCornerControl`). Its parts come in their own chunks: Button (the aside button, Feedback), Badge (offline), Progress (the reading line), ScrollToTop.
