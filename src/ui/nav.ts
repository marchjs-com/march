// NavMenu: sidebar navigation for big apps — groups (collapsible), pinned and recently used items, filter, active item from
// the router path, and a drawer with a hamburger button on small screens. UI state persists in localStorage.
import { signal, computed, effect, untrack } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t, locale } from "../core/i18n.ts";
import { Link, path, navigate, type Href } from "../router/index.ts";
import { can, type PermCheck } from "../access/index.ts";
import { Badge } from "./display.ts";
import { rank } from "./fold.ts";
import { compareText } from "../core/text.ts";
import { registerPages } from "./registry.ts";
import { val, cx, uid, icon, load, save, on, type MaybeFn, type ClassProp } from "./util.ts";

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

interface SavedNav { collapsed?: unknown; pins?: unknown; recent?: unknown }

/** items: [{ id, title, href, icon?, group?, badge?: () => number, keywords?, can?, hidden? }] */
export function NavMenu(props: NavMenuProps): Element {
  const storeKey = props.storageKey ?? "hm.nav";
  const maxPinned = props.maxPinned ?? 8, maxRecent = props.maxRecent ?? 5;
  const saved = load<SavedNav | null>(storeKey, {}) ?? {};
  const collapsed = signal(new Set(arr<string>(saved.collapsed)));
  const pins = signal(arr<string>(saved.pins));
  const recent = signal(arr<string>(saved.recent));
  const persist = (): void => save(storeKey, { collapsed: [...collapsed.peek()], pins: pins.peek(), recent: recent.peek() });
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
      class: () => cx("hm-nav-item", active() === x.id && "is-active"),
      children: [icon(x.icon, "hm-icon hm-nav-icon"), h("span", { class: "hm-nav-label" }, () => titleOf(x)),
        x.badge !== undefined && h(Badge, { count: () => val(x.badge), max: 99 })],
    }),
    h("button", {
      type: "button", class: () => cx("hm-nav-pin", isPinned(x.id) && "is-pinned"), "data-pin": x.id,
      "aria-pressed": () => String(isPinned(x.id)), "aria-label": () => (isPinned(x.id) ? t`Unpin ${titleOf(x)}` : t`Pin ${titleOf(x)}`),
      onClick: () => togglePin(x.id),
    }, () => (isPinned(x.id) ? "★" : "☆")));

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
    const rec = recent().map((id) => m.get(id)).filter((x): x is NavItem => !!x);
    const gs = groups();
    return untrack(() => [
      pinned.length > 0 && block(() => t`Pinned`, pinned, "pinned", "hm-nav-pinned"),
      rec.length > 0 && block(() => t`Recent`, rec, "recent", "hm-nav-recent"),
      gs.map((g) => {
        if (g.name === "") return h("ul", { class: "hm-nav-list" }, g.items.map((x) => item(x, "main")));
        const gid = uid("hm-navg");
        const isOpen = (): boolean => !collapsed().has(g.name);
        return h("div", { class: "hm-nav-group" },
          h("button", { type: "button", class: "hm-nav-gbtn", "data-group": g.name, "aria-expanded": () => String(isOpen()), "aria-controls": gid, onClick: () => toggleGroup(g.name) },
            h("span", { class: "hm-nav-chev", "aria-hidden": "true" }, () => (isOpen() ? "▾" : "▸")), g.name),
          h("ul", { class: "hm-nav-list", id: gid, hidden: () => !isOpen() }, g.items.map((x) => item(x, "main"))));
      }),
    ]);
  };

  return h("div", { class: () => cx("hm-nav-wrap", open() && "is-open", val(props.class)) },
    h("button", { type: "button", class: "hm-icon-btn hm-nav-burger", "aria-controls": navId, "aria-expanded": () => String(open()), "aria-label": () => t`Menu`, onClick: () => open.update((x) => !x) }, "☰"),
    h("div", { class: "hm-nav-scrim", "aria-hidden": "true", onClick: () => open.set(false) }),
    h("nav", { class: "hm-nav", id: navId, "aria-label": () => val(props.label) ?? t`Main` },
      props.brand != null && h("div", { class: "hm-nav-brand" }, props.brand),
      props.filter !== false && h("div", { class: "hm-nav-filter" },
        h("input", {
          type: "search", class: "hm-input hm-input-sm", placeholder: () => t`Filter…`, "aria-label": () => t`Filter menu`,
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
