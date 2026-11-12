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
import { Layout, defineLayout, defineLayoutFeature, scrollToTopFeature } from "hadi-march/layout";

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
| `titleTemplate` | Document title pattern for pages, `"%s · March"`. |
| `framed` | Always draw the frame (skip link, main), also without regions. |
| `mainId` | id of the main element (skip-link target), default `main`. |
| `class` | Class of the frame. |

## Accessibility

A skip link to `main` (focusable, `tabindex="-1"`); landmarks `header`, `nav` (aside element), `main`, `aside`,
`footer`; corners are `role="group"` with a translated name. `routeFocus` moves focus to main after a route change and
reads the new title in a polite live region. The reading bar is a `progressbar` that keeps working with reduced motion.

## Composed of

Uses the page corners (`addCornerControl`) and loads ScrollToTop lazily; no component copied.
