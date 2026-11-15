// NavMenu: sidebar navigation for big apps — groups (collapsible), pinned and recently used items, filter, active item from
// the router path, and a Drawer with a hamburger button on small screens (drawer.ts, shared with NavSidebar). UI state persists in localStorage.
import "./nav-menu.css";
import { signal, computed, effect, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, locale } from "../../../core/i18n.ts";
import { path, navigate, type Href } from "../../../router/router.ts";
import { can, type PermCheck } from "../../../access/index.ts";
import { Badge } from "../../../ui/badge.ts";
import { rank } from "../../../ui/fold.ts";
import { compareText } from "../../../core/text.ts";
import { registerPages } from "../../../ui/registry.ts";
import { val, cx, uid, icon, load, save, arr, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { menu } from "../../../icons/glyphs/menu.ts";
import { star } from "../../../icons/glyphs/star.ts";
import { starFilled } from "../../../icons/glyphs/starFilled.ts";
import { panelLeft } from "../../../icons/glyphs/panelLeft.ts";
import type { IconDef } from "../../../icons/svg.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { Chevron } from "../../actions/chevron/index.ts";
import { ListRow } from "../../data/list-row/index.ts";
import { SearchBox } from "../../forms/search-box/index.ts";
import { Empty } from "../../feedback/empty/index.ts";
import { SectionLabel } from "../../typography/section-label/index.ts";
import { navDrawer } from "./drawer.ts";

/** A NavMenu entry. */
export interface NavItem {
  id: string;
  title: MaybeFn<string>;
  href: Href;
  icon?: unknown;
  group?: string;
  badge?: MaybeFn<number | null | undefined>;
  keywords?: string;
  can?: PermCheck;
  hidden?: MaybeFn<boolean | undefined>;
}
/** Sort order: "alpha" (default, locale collation), "none"/false, or a compare function. */
export type NavSort = "alpha" | "none" | false | ((a: { title: MaybeFn<string> }, b: { title: MaybeFn<string> }) => number);

export interface NavMenuProps {
  /** The pages: `{ id, title, href, icon?, group?, badge?, keywords?, can?, hidden? }` (an array or an accessor). @tr Sayfalar: `{ id, title, href, icon?, group?, badge?, keywords?, can?, hidden? }` (dizi ya da erişimci). */
  items: MaybeFn<readonly (NavItem | null | undefined | false)[] | null | undefined>;
  /** localStorage key for pins, recents and collapsed groups (default "m.nav"). @tr Sabitlenenler, son açılanlar ve katlanmış gruplar için localStorage anahtarı (varsayılan "m.nav"). */
  storageKey?: string;
  /** Most items in the Pinned block (default 8). @tr Sabitlenenler bloğunda en çok kaç öğe olur (varsayılan 8). */
  maxPinned?: number;
  /** Most items in the Recent block (default 5); 0: no Recent block. @tr Son açılanlar bloğunda en çok kaç öğe olur (varsayılan 5); 0 ile blok yok. */
  maxRecent?: number;
  /** Item order within a group: "alpha" (default), "none" / false or a compare function. @tr Grup içindeki öğe sırası: "alpha" (varsayılan), "none" / false ya da bir karşılaştırma fonksiyonu. */
  sort?: NavSort;
  /** The top slot (logo, product name). @tr Üstteki yuva (logo, ürün adı). */
  brand?: unknown;
  /** The bottom slot. @tr Alttaki yuva. */
  footer?: unknown;
  /** Accessible name of the nav (default "Main", translated). @tr nav öğesinin erişilebilir adı (varsayılan "Main", çevrilir). */
  label?: MaybeFn<string | undefined>;
  /** false: no filter box. @tr false: süzme kutusu yok. */
  filter?: boolean;
  /** false: do not register the pages with the command palette. @tr false: sayfalar komut paletine kaydedilmez. */
  palette?: boolean;
  /** Show a button that collapses the sidebar to an icon rail (state persists). @tr Kenar çubuğunu bir ikon rayına katlayan bir düğme gösterir (durum saklanır). */
  collapsible?: boolean;
  /** Groups start collapsed; the group of the active page opens itself. @tr Gruplar katlanmış başlar; etkin sayfanın grubu kendiliğinden açılır. */
  groupsCollapsed?: boolean;
  /** Icons for group headings (also the default icon of the group's items): `{ "Billing": wallet }`. @tr Grup başlıklarının ikonları (grubun öğelerinin varsayılan ikonu da): `{ "Billing": wallet }`. */
  groupIcons?: Readonly<Record<string, unknown>>;
  /** The pin (star) button of every item and the Pinned block (default true). @tr Her öğenin sabitleme (yıldız) düğmesi ve Sabitlenenler bloğu (varsayılan true). */
  pins?: boolean | undefined;
  /**
   * Own icons for the built-in parts (an IconDef, a short string or a node): the menu button, the pin star (off / on),
   * the group chevron, the filter's search icon and the rail button. `chevron: false` / `search: false` drop that mark.
   * @tr Yerleşik parçaların kendi ikonları (IconDef, kısa metin ya da düğüm): menü düğmesi, yıldız (kapalı / açık), grup oku, süzgecin arama ikonu ve ray düğmesi. `chevron: false` / `search: false` o işareti kaldırır.
   */
  icons?: { menu?: unknown; pin?: unknown; pinned?: unknown; chevron?: unknown; search?: unknown; rail?: unknown } | undefined;
  /** Own texts (strings or accessors); defaults are the translated ones. `pin` / `unpin` name an item's pin button. @tr Kendi metinlerin (metin ya da erişimci); varsayılanlar çevrilmiş olanlardır. `pin` / `unpin` öğenin sabitleme düğmesini adlandırır. */
  labels?: {
    filter?: MaybeFn<string>; filterPlaceholder?: MaybeFn<string>; noMatches?: MaybeFn<string>; pinned?: MaybeFn<string>; recent?: MaybeFn<string>;
    menu?: MaybeFn<string>; expandSidebar?: MaybeFn<string>; collapseSidebar?: MaybeFn<string>;
    pin?: (title: string) => string; unpin?: (title: string) => string;
  } | undefined;
  /** Extra class on the wrapper. @tr Sarmalayıcıya eklenen sınıf. */
  class?: ClassProp;
}

const titleOf = (x: { title?: MaybeFn<string | null | undefined> }): string => String(val(x.title) ?? "");

/** Order helper shared with the palette: "alpha" (default, Intl.Collator of the active locale), "none", or a compare fn. */
export function sorter(sort: NavSort | undefined, loc?: string): ((a: { title: MaybeFn<string> }, b: { title: MaybeFn<string> }) => number) | null {
  if (typeof sort === "function") return sort;
  if (sort === false || sort === "none") return null;
  return (a, b) => compareText(titleOf(a), titleOf(b), loc);
}

interface SavedNav { collapsed?: unknown; opened?: unknown; pins?: unknown; recent?: unknown; rail?: unknown }

/** items: [{ id, title, href, icon?, group?, badge?: () => number, keywords?, can?, hidden? }] */
export function NavMenu(props: NavMenuProps): Element {
  const storeKey = props.storageKey ?? "m.nav";
  const maxPinned = props.maxPinned ?? 8, maxRecent = props.maxRecent ?? 5;
  const saved = load<SavedNav | null>(storeKey, {}) ?? {};
  const startClosed = !!props.groupsCollapsed;
  // groupsCollapsed: the set holds the groups the user opened; otherwise the ones they closed
  const collapsed = signal(new Set(arr<string>(startClosed ? saved.opened : saved.collapsed)));
  const rail = signal(!!props.collapsible && saved.rail === true);
  const pins = signal(arr<string>(saved.pins));
  const recent = signal(arr<string>(saved.recent));
  const persist = (): void => save(storeKey, { [startClosed ? "opened" : "collapsed"]: [...collapsed.peek()], pins: pins.peek(), recent: recent.peek(), ...(props.collapsible ? { rail: rail.peek() } : {}) });
  const q = signal("");
  const navId = uid("m-nav");
  const pinsOn = props.pins !== false;
  type TextKey = Exclude<keyof NonNullable<NavMenuProps["labels"]>, "pin" | "unpin">;
  const L = (k: TextKey, d: string): string => val(props.labels?.[k]) ?? d;
  type IconKey = keyof NonNullable<NavMenuProps["icons"]>;
  // a built-in mark, or the developer's own (an IconDef is drawn like the built-in one)
  const mark = (k: IconKey, d: IconDef): unknown => { const x = props.icons?.[k]; return ownIcon(x == null || x === false ? undefined : x, d, null); };
  // narrow screens: the menu opens in a Drawer from the menu button
  const sheet = navDrawer({ id: navId, label: () => val(props.label) ?? t`Main`, menuLabel: () => L("menu", t`Menu`), icon: mark("menu", menu), class: () => !pinsOn && "m-nav-nopins" });
  const open = sheet.open;
  const items = computed(() => arr<NavItem | null | undefined | false>(val(props.items)).filter((x): x is NavItem => !!x && !val(x.hidden) && can(x.can)));
  const byId = computed(() => new Map(items().map((x) => [x.id, x])));
  const cmp = computed(() => sorter(props.sort, locale()));
  const groups = computed(() => {
    const map = new Map<string, NavItem[]>();
    for (const x of items()) { const g = x.group ?? ""; let l = map.get(g); if (!l) map.set(g, l = []); l.push(x); }
    const c = cmp();
    const out = [...map].map(([name, list]) => ({ name, items: c ? [...list].sort(c) : list }));
    if (c) out.sort((a, b) => (a.name === "" ? -1 : b.name === "" ? 1 : c({ title: a.name }, { title: b.name })));
    return out;
  });
  const active = computed(() => {
    const p = path();
    let best: { id: string; len: number } | null = null;
    for (const x of items()) {
      const href = String(x.href ?? "").split("?")[0] ?? "";
      if (!href) continue;
      if ((p === href || (href !== "/" && p.startsWith(`${href}/`))) && (!best || href.length > best.len)) best = { id: x.id, len: href.length };
    }
    return best?.id ?? null;
  });
  // remember visits; close the mobile drawer after navigating
  effect(() => {
    const id = active();
    untrack(() => {
      open.set(false);
      if (id != null && startClosed) {
        const g = byId.peek().get(id)?.group;
        if (g && !collapsed.peek().has(g)) collapsed.update((s) => new Set(s).add(g));
      }
      if (id == null || maxRecent <= 0) return;
      const next = [id, ...recent.peek().filter((x) => x !== id)].slice(0, maxRecent);
      if (next.join("\n") !== recent.peek().join("\n")) { recent.set(next); persist(); }
    });
  });
  if (props.palette !== false) registerPages(() => items().filter((x) => x.href).map((x) => ({ id: x.id, title: titleOf(x), href: x.href, group: x.group, keywords: x.keywords, icon: x.icon })));

  const isPinned = (id: string): boolean => pins().includes(id);
  const togglePin = (id: string): void => {
    pins.update((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id].slice(-maxPinned)));
    persist();
  };
  const toggleGroup = (g: string): void => {
    collapsed.update((s) => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n; });
    persist();
  };

  // a row: the page link (ListRow) and, beside it, the pin (the smallest IconButton, a toggle)
  const item = (x: NavItem, where: string): Element => h("li", { class: "m-nav-li" },
    h(ListRow, {
      href: x.href, "data-id": x.id, "data-where": where, size: "sm", class: "m-nav-item", active: () => active() === x.id, tooltip: () => (rail() ? titleOf(x) : null),
      lead: icon(x.icon ?? (x.group ? props.groupIcons?.[x.group] : undefined), "m-icon m-nav-icon"), title: () => titleOf(x),
      trail: x.badge !== undefined ? h(Badge, { count: () => val(x.badge), max: 99 }) : undefined,
    }),
    pinsOn && h(IconButton, {
      size: "xs", class: "m-nav-pin", "data-pin": x.id, pressed: () => isPinned(x.id), title: false,
      label: () => (isPinned(x.id) ? props.labels?.unpin?.(titleOf(x)) ?? t`Unpin ${titleOf(x)}` : props.labels?.pin?.(titleOf(x)) ?? t`Pin ${titleOf(x)}`),
      onClick: () => togglePin(x.id), icon: () => (isPinned(x.id) ? mark("pinned", starFilled) : mark("pin", star)),
    }));

  const block = (label: () => string, list: NavItem[], where: string, cls: string): Element => h("div", { class: cx("m-nav-group", cls) },
    h(SectionLabel, { class: "m-nav-heading", label }),
    h("ul", { class: "m-nav-list" }, list.map((x) => item(x, where))));

  const body = (): unknown => {
    const query = q();
    if (query.trim()) {
      const hits = untrack(() => rank(query, items(), (x) => ({ title: titleOf(x), keywords: [x.keywords, x.group].filter(Boolean).join(" ") })));
      if (!hits.length) return h(Empty, { size: "sm", class: "m-nav-none", title: () => L("noMatches", t`No matches`) });
      return untrack(() => h("ul", { class: "m-nav-list m-nav-results" }, hits.map((r) => item(r.item, "filter"))));
    }
    const m = byId();
    const pinned = pinsOn ? pins().map((id) => m.get(id)).filter((x): x is NavItem => !!x) : [];
    // recents: grouped items other than the current page (top-level items are always visible anyway)
    const cur = active();
    const rec = recent().map((id) => m.get(id)).filter((x): x is NavItem => !!x && !!x.group && x.id !== cur);
    const gs = groups();
    return untrack(() => [
      pinned.length > 0 && block(() => L("pinned", t`Pinned`), pinned, "pinned", "m-nav-pinned"),
      rec.length > 0 && block(() => L("recent", t`Recent`), rec, "recent", "m-nav-recent"),
      gs.map((g) => {
        if (g.name === "") return h("ul", { class: "m-nav-list" }, g.items.map((x) => item(x, "main")));
        const gid = uid("m-navg");
        const isOpen = (): boolean => rail() || (collapsed().has(g.name) === startClosed);
        return h("div", { class: "m-nav-group" },
          h(ListRow, {
            size: "sm", class: "m-nav-gbtn", "data-group": g.name, "aria-expanded": () => String(isOpen()), "aria-controls": gid, onClick: () => toggleGroup(g.name),
            lead: icon(props.groupIcons?.[g.name], "m-icon m-nav-gicon"), title: g.name,
            trail: props.icons?.chevron !== false ? h(Chevron, { class: "m-nav-chev", icon: props.icons?.chevron === true ? undefined : props.icons?.chevron }) : undefined,
          }),
          h("ul", { class: "m-nav-list", id: gid, hidden: () => !isOpen() }, g.items.map((x) => item(x, "main"))));
      }),
    ]);
  };

  const toggleRail = (): void => { rail.update((x) => !x); persist(); };
  const railName = (): string => (rail() ? L("expandSidebar", t`Expand sidebar`) : L("collapseSidebar", t`Collapse sidebar`));
  return h("div", { class: () => cx("m-nav-wrap", open() && "is-open", rail() && "is-rail", !pinsOn && "m-nav-nopins", val(props.class)) },
    sheet.burger,
    sheet.place(h("nav", { class: "m-nav", id: navId, "aria-label": () => val(props.label) ?? t`Main` },
      (props.brand != null || props.collapsible) && h("div", { class: "m-nav-brand" },
        props.brand != null && h("div", { class: "m-nav-brand-main" }, props.brand),
        props.collapsible && h(IconButton, { size: "sm", class: "m-nav-rail-btn", pressed: rail, label: railName, onClick: toggleRail, icon: mark("rail", panelLeft) })),
      props.filter !== false && h("div", { class: "m-nav-filter" },
        h(SearchBox, {
          size: "sm", value: q, debounce: 0, clear: false, icon: props.icons?.search === false ? false : props.icons?.search == null || props.icons.search === true ? true : props.icons.search,
          placeholder: () => L("filterPlaceholder", t`Filter…`), label: () => L("filter", t`Filter menu`),
          onKeyDown: (e: KeyboardEvent) => {
            if (e.key === "Escape") q.set("");
            if (e.key !== "Enter" || !q.peek().trim()) return;
            const first = rank(q.peek(), items.peek(), (x) => ({ title: titleOf(x), keywords: x.keywords }))[0];
            if (first?.item.href) { try { void navigate(first.item.href); } catch { /* no router */ } }
          },
        })),
      h("div", { class: "m-nav-scroll" }, body),
      props.footer != null && h("div", { class: "m-nav-foot" }, props.footer))));
}
