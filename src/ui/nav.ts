// NavMenu: sidebar navigation for big apps — groups (collapsible), pinned and recently used items, filter, active item from
// the router path, and a drawer with a hamburger button on small screens. UI state persists in localStorage.
import "./nav.css";
import "./field.css";
import "./button.css";
import { signal, computed, effect, untrack } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t, locale } from "../core/i18n.ts";
import { Link, path, navigate, type Href } from "../router/index.ts";
import { can, type PermCheck } from "../access/index.ts";
import { Badge } from "./display.ts";
import { rank } from "./fold.ts";
import { compareText } from "../core/text.ts";
import { registerPages } from "./registry.ts";
import { val, cx, uid, icon, glyph, load, save, on, type MaybeFn, type ClassProp } from "./util.ts";
import { menu, star, starFilled, chevronRight, search, panelLeft } from "../icons/set.ts";
import { OverflowText } from "./marquee.ts";

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
  items: MaybeFn<readonly (NavItem | null | undefined | false)[] | null | undefined>;
  /** localStorage key for pins, recents and collapsed groups (default "hm.nav"). */
  storageKey?: string;
  maxPinned?: number;
  maxRecent?: number;
  sort?: NavSort;
  brand?: unknown;
  footer?: unknown;
  label?: MaybeFn<string | undefined>;
  /** false: no filter box. */
  filter?: boolean;
  /** false: do not register the pages with the command palette. */
  palette?: boolean;
  /** Show a button that collapses the sidebar to an icon rail (state persists). */
  collapsible?: boolean;
  /** Groups start collapsed; the group of the active page opens itself. */
  groupsCollapsed?: boolean;
  /** Icons for group headings (also the default icon of the group's items): `{ "Billing": wallet }`. */
  groupIcons?: Readonly<Record<string, unknown>>;
  class?: ClassProp;
}

const arr = <T>(x: unknown): T[] => (Array.isArray(x) ? x as T[] : []);
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
  const storeKey = props.storageKey ?? "hm.nav";
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
  const open = signal(false);
  const navId = uid("hm-nav");

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
  on<KeyboardEvent>(globalThis.document, "keydown", (e) => { if (e.key === "Escape" && open.peek()) open.set(false); });

  const isPinned = (id: string): boolean => pins().includes(id);
  const togglePin = (id: string): void => {
    pins.update((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id].slice(-maxPinned)));
    persist();
  };
  const toggleGroup = (g: string): void => {
    collapsed.update((s) => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n; });
    persist();
  };

  const item = (x: NavItem, where: string): Element => h("li", { class: "hm-nav-li" },
    h(Link, {
      href: x.href, "data-id": x.id, "data-where": where,
      class: () => cx("hm-nav-item", active() === x.id && "is-active"), title: () => (rail() ? titleOf(x) : null),
      "aria-current": () => (active() === x.id ? "page" : null),
      children: [icon(x.icon ?? (x.group ? props.groupIcons?.[x.group] : undefined), "hm-icon hm-nav-icon"), h(OverflowText, { class: "hm-nav-label" }, () => titleOf(x)),
        x.badge !== undefined && h(Badge, { count: () => val(x.badge), max: 99 })],
    }),
    h("button", {
      type: "button", class: () => cx("hm-nav-pin", isPinned(x.id) && "is-pinned"), "data-pin": x.id,
      "aria-pressed": () => String(isPinned(x.id)), "aria-label": () => (isPinned(x.id) ? t`Unpin ${titleOf(x)}` : t`Pin ${titleOf(x)}`),
      onClick: () => togglePin(x.id),
    }, () => glyph(isPinned(x.id) ? starFilled : star)));

  const block = (label: () => string, list: NavItem[], where: string, cls: string): Element => h("div", { class: cx("hm-nav-group", cls) },
    h("div", { class: "hm-nav-heading" }, label),
    h("ul", { class: "hm-nav-list" }, list.map((x) => item(x, where))));

  const body = (): unknown => {
    const query = q();
    if (query.trim()) {
      const hits = untrack(() => rank(query, items(), (x) => ({ title: titleOf(x), keywords: [x.keywords, x.group].filter(Boolean).join(" ") })));
      if (!hits.length) return h("p", { class: "hm-nav-none" }, () => t`No matches`);
      return untrack(() => h("ul", { class: "hm-nav-list hm-nav-results" }, hits.map((r) => item(r.item, "filter"))));
    }
    const m = byId();
    const pinned = pins().map((id) => m.get(id)).filter((x): x is NavItem => !!x);
    // recents: grouped items other than the current page (top-level items are always visible anyway)
    const cur = active();
    const rec = recent().map((id) => m.get(id)).filter((x): x is NavItem => !!x && !!x.group && x.id !== cur);
    const gs = groups();
    return untrack(() => [
      pinned.length > 0 && block(() => t`Pinned`, pinned, "pinned", "hm-nav-pinned"),
      rec.length > 0 && block(() => t`Recent`, rec, "recent", "hm-nav-recent"),
      gs.map((g) => {
        if (g.name === "") return h("ul", { class: "hm-nav-list" }, g.items.map((x) => item(x, "main")));
        const gid = uid("hm-navg");
        const isOpen = (): boolean => rail() || (collapsed().has(g.name) === startClosed);
        return h("div", { class: "hm-nav-group" },
          h("button", { type: "button", class: "hm-nav-gbtn", "data-group": g.name, "aria-expanded": () => String(isOpen()), "aria-controls": gid, onClick: () => toggleGroup(g.name) },
            icon(props.groupIcons?.[g.name], "hm-icon hm-nav-gicon"), h(OverflowText, { class: "hm-nav-gname" }, g.name),
            h("span", { class: "hm-nav-chev", "aria-hidden": "true" }, glyph(chevronRight))),
          h("ul", { class: "hm-nav-list", id: gid, hidden: () => !isOpen() }, g.items.map((x) => item(x, "main"))));
      }),
    ]);
  };

  const toggleRail = (): void => { rail.update((x) => !x); persist(); };
  return h("div", { class: () => cx("hm-nav-wrap", open() && "is-open", rail() && "is-rail", val(props.class)) },
    h("button", { type: "button", class: "hm-icon-btn hm-nav-burger", "aria-controls": navId, "aria-expanded": () => String(open()), "aria-label": () => t`Menu`, onClick: () => open.update((x) => !x) }, glyph(menu)),
    h("div", { class: "hm-nav-scrim", "aria-hidden": "true", onClick: () => open.set(false) }),
    h("nav", { class: "hm-nav", id: navId, "aria-label": () => val(props.label) ?? t`Main` },
      (props.brand != null || props.collapsible) && h("div", { class: "hm-nav-brand" },
        props.brand != null && h("div", { class: "hm-nav-brand-main" }, props.brand),
        props.collapsible && h("button", { type: "button", class: "hm-icon-btn hm-btn-sm hm-nav-rail-btn", "aria-pressed": () => String(rail()),
          "aria-label": () => (rail() ? t`Expand sidebar` : t`Collapse sidebar`), title: () => (rail() ? t`Expand sidebar` : t`Collapse sidebar`), onClick: toggleRail }, glyph(panelLeft))),
      props.filter !== false && h("div", { class: "hm-nav-filter" },
        h("span", { class: "hm-nav-filter-icon", "aria-hidden": "true" }, glyph(search)),
        h("input", {
          type: "search", class: "hm-input hm-input-sm hm-nav-filter-input", placeholder: () => t`Filter…`, "aria-label": () => t`Filter menu`,
          onInput: (e: Event) => q.set((e.target as HTMLInputElement).value),
          onKeydown: (e: KeyboardEvent) => {
            const el = e.target as HTMLInputElement;
            if (e.key === "Escape") { el.value = ""; q.set(""); }
            if (e.key !== "Enter" || !q.peek().trim()) return;
            const first = rank(q.peek(), items.peek(), (x) => ({ title: titleOf(x), keywords: x.keywords }))[0];
            if (first?.item.href) { try { void navigate(first.item.href); } catch { /* no router */ } }
          },
        })),
      h("div", { class: "hm-nav-scroll" }, body),
      props.footer != null && h("div", { class: "hm-nav-foot" }, props.footer)));
}
