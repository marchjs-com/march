// AppShell (hadi-march/ui): the application frame. Its own module so an app's entry does not pull in Page, tabs or
// search (layout.ts) just to draw the frame.
import "../../../ui/crumbs.css";
import "./app-shell.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type ClassProp } from "../../../core/util.ts";

export interface AppShellProps {
  nav?: unknown;
  /** Above everything in the main column (banners). */
  top?: unknown;
  /** Sticky top bar of the main column (title, search, user menu). On narrow screens the menu button sits in it. */
  header?: unknown;
  mainId?: string;
  class?: ClassProp;
  children?: unknown;
}
/**
 * Application frame: a sidebar (usually <NavMenu/>) and the main area. Desktop: sticky sidebar column + scrolling main.
 * Narrow screens: a slim top bar with the menu button (the NavMenu becomes a drawer) and full-width main.
 * `<AppShell nav={<NavMenu items={…} />} top={<UpdateBanner/>}>…pages…</AppShell>`
 */
export function AppShell(props: AppShellProps): Element {
  return h("div", { class: () => cx("hm-shell", props.header != null && "hm-shell-has-header", val(props.class)) },
    h("a", { class: "hm-skip", href: `#${props.mainId ?? "main"}` }, () => t`Skip to content`),
    h("aside", { class: "hm-shell-nav" }, () => props.nav),
    h("div", { class: "hm-shell-body" },
      props.top != null ? h("div", { class: "hm-shell-top" }, () => props.top) : null,
      props.header != null ? h("header", { class: "hm-shell-header" }, () => props.header) : null,
      h("main", { class: "hm-shell-main", id: props.mainId ?? "main", tabindex: "-1" }, () => props.children)));
}
