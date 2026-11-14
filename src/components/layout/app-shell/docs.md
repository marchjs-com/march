# AppShell

The application frame. Desktop: a sticky sidebar column (usually a NavMenu or NavSidebar) and a scrolling main area;
above the main column an optional banner slot (`top`, for update or offline banners) and a sticky header (`header`,
for the title, search and user menu). Narrow screens: a slim top bar with the menu button and a full-width main. A
"Skip to content" link comes first. It is its own module, so an app's entry does not pull in page scaffolding.

```tsx
<AppShell nav={<NavMenu items={items} />} top={<UpdateBanner />} header={<PageTitle />}>
  <Outlet />
</AppShell>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `nav` | node | — | the sidebar |
| `top` | node | — | banner above the main column |
| `header` | node | — | sticky header of the main column |
| `mainId` | string | `"main"` | id of `<main>` (the skip link target) |
| `children` | node | — | the page |
| `aside`, `footer` | node | — | a side panel next to the page; a footer under it |
| `corners` | `{ "top-end": node … }` | — | content for the page corners |
| `features` | config / list | `scrollToTop`, `routeFocus` | page-wide behaviors (see Layout) |
| `labels` | `{ skip, panel }` | translated | the skip link text and the aside button text |
| `skipLink` | boolean | `true` | `false`: no "Skip to content" link |
| `asideToggle` | boolean | `true` | `false`: no corner button for the aside sheet on narrow screens |
| `class` | class | — | added to the frame (`.hm-shell`); parts: `.hm-skip`, `.hm-shell-nav`, `.hm-shell-top`, `.hm-shell-header`, `.hm-shell-main` |

AppShell is `Layout.extend({ framed: true })`: every Layout prop works, and `AppShell.extend({ … })` derives your own.

```tsx
<AppShell nav={<NavMenu items={items} />} labels={{ skip: "Jump to the page" }}>…</AppShell>
<AppShell nav={<NavMenu items={items} />} skipLink={false}>…</AppShell>
```

## Accessibility

Landmarks: `<aside>` for the sidebar, `<header>`, `<main>` (focusable, the skip link target). The skip link is the
first Tab stop and becomes visible on focus.

## Composed of

No other component: the slots hold whatever the app puts there.
