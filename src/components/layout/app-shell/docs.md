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

## Accessibility

Landmarks: `<aside>` for the sidebar, `<header>`, `<main>` (focusable, the skip link target). The skip link is the
first Tab stop and becomes visible on focus.

## Composed of

No other component: the slots hold whatever the app puts there.
