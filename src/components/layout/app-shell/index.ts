// AppShell (hadi-march/ui): the application frame — a Layout variant that always draws the frame (skip link, sidebar,
// sticky header, scrolling main; the sidebar becomes a drawer on narrow screens). Everything Layout has comes with it:
// aside and footer regions, page corners, features (back-to-top, route focus by default). Its own module so an app's
// entry does not pull in Page, tabs or search (layout.ts) just to draw the frame.
import { Layout, type LayoutProps, type LayoutComponent } from "../layout/index.ts";

export type AppShellProps = LayoutProps;
/**
 * Application frame: a sidebar (usually <NavMenu/>) and the main area. Desktop: sticky sidebar column + scrolling main.
 * Narrow screens: a slim top bar with the menu button (the NavMenu becomes a drawer) and full-width main.
 * `<AppShell nav={<NavMenu items={…} />} top={<UpdateBanner/>} header={<TopBar/>} features={{ readingProgress: true }}>…</AppShell>`
 */
export const AppShell: LayoutComponent = Layout.extend({ framed: true });
