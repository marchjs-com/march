// The narrow-screen drawer of NavMenu and NavSidebar: under the breakpoint the menu leaves the page and opens in a
// Drawer (start edge: scrim, Escape, focus trap, drag to close) from the menu button. The Drawer module loads on the
// first open; wide screens never download it.
import { signal, effect, untrack, reactive, type Signal } from "../../../core/reactive.ts";
import { h, lazyChildren } from "../../../dom/h.ts";
import { cx } from "../../../ui/util.ts";
import { whenMedia } from "../../../ui/observe.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import type { Drawer, DrawerProps } from "../../overlays/drawer/index.ts";

/** Under this width the menu is a drawer (app-shell.css moves the menu button into the header at the same width). */
export const NAV_NARROW = "(max-width: 900px)";

export interface NavDrawerOptions {
  /** Id of the `<nav>` (the menu button's `aria-controls`). */
  id: string;
  /** Accessible name of the drawer (the menu's own name). */
  label: () => string;
  /** Accessible name and icon of the menu button. */
  menuLabel: () => string;
  icon: unknown;
  /** Classes of the drawer panel: the host's size class and the state classes its rows are styled by. */
  class?: () => unknown;
  /** After the menu has moved into the drawer (bring the current row into view). */
  onShow?: () => void;
}
export interface NavDrawer {
  /** The drawer is open (only shown under the breakpoint). */
  open: Signal<boolean>;
  narrow: () => boolean;
  /** The menu button (`.m-nav-burger`; CSS shows it under the breakpoint). */
  burger: unknown;
  /** Where the menu goes: in place on wide screens, into the Drawer on narrow ones. */
  place(nav: Element): () => unknown;
}

export function navDrawer(o: NavDrawerOptions): NavDrawer {
  const open = signal(false);
  const narrow = whenMedia(NAV_NARROW);
  const sheet = signal<{ Drawer: typeof Drawer } | null>(null);
  effect(() => {
    if (!narrow()) { untrack(() => open.set(false)); return; }
    if (open() && !untrack(sheet)) void import("../../overlays/drawer/index.ts").then((m) => sheet.set({ Drawer: m.Drawer }));
  });
  const burger = h(IconButton, { class: "m-nav-burger", "aria-controls": o.id, "aria-expanded": () => String(open()), label: o.menuLabel, title: false, onClick: () => open.update((x) => !x), icon: o.icon });
  const place = (nav: Element) => (): unknown => {
    if (!narrow()) return nav;
    const s = sheet();
    return s ? untrack(() => h(s.Drawer, {
      open: () => open(), onClose: () => open.set(false), side: "start", closeButton: false, label: reactive(o.label), class: reactive(() => cx("m-nav-sheet", o.class?.())),
    } as unknown as DrawerProps, lazyChildren(() => { if (o.onShow) queueMicrotask(o.onShow); return nav; }))) : null;
  };
  return { open, narrow, burger, place };
}
