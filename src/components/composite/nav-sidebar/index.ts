// NavSidebar: a rich application sidebar — title, search box ("Search or ask…", Ctrl+K), featured items with live badges,
// recently visited items, and collapsible categories with counts ("expand / collapse all"). Keyboard: ↑ ↓ Home End move
// between rows, → opens and ← closes a category (← on an item goes to its category), Enter activates, typing filters.
// Remembers open categories and recent visits (localStorage); icon rail mode; drawer with a menu button on small screens.
import "./nav-sidebar.css";
import "../../navigation/nav-menu/nav-menu.css";
import { signal, computed, effect, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { path, navigate, type Href } from "../../../router/router.ts";
import { can, type PermCheck } from "../../../access/index.ts";
import { rank } from "../../../ui/fold.ts";
import { compareText } from "../../../core/text.ts";
import { registerPages } from "../../../ui/registry.ts";
import { key as hotkey } from "../../../ui/keys.ts";
import { roving } from "../../../ui/focus.ts";
import { scrollIntoArea } from "../../../ui/observe.ts";
import { val, cx, uid, icon, load, save, arr, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { menu } from "../../../icons/glyphs/menu.ts";
import { clock } from "../../../icons/glyphs/clock.ts";
import { panelLeft } from "../../../icons/glyphs/panelLeft.ts";
import { clamp } from "../../../core/util.ts";
import { reducedMotion } from "../../../motion/env.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { Button } from "../../actions/button/index.ts";
import { Chevron } from "../../actions/chevron/index.ts";
import { Badge } from "../../data/badge/index.ts";
import { ListRow } from "../../data/list-row/index.ts";
import { Empty } from "../../feedback/empty/index.ts";
import { SearchBox } from "../../forms/search-box/index.ts";
import { PanelHeader } from "../../layout/panel-header/index.ts";
import { ResizeHandle } from "../../layout/resize-handle/index.ts";
import { SectionLabel } from "../../typography/section-label/index.ts";
import { navDrawer } from "../../navigation/nav-menu/drawer.ts";

/** One NavSidebar entry. `href` navigates (router Link); `onSelect` runs instead. */
export interface NavSidebarItem {
  id: string;
  label: MaybeFn<string>;
  /** Second line (a status, a category name…). */
  sub?: MaybeFn<string | null | undefined>;
  icon?: unknown;
  href?: Href;
  onSelect?: () => void;
  /** Count (hidden at 0) or short text. */
  badge?: MaybeFn<number | string | null | undefined>;
  badgeTone?: "danger" | "primary" | "neutral";
  group?: string;
  keywords?: string;
  can?: PermCheck;
  hidden?: MaybeFn<boolean | undefined>;
  /** Id of the item this one sits under: listed indented below it, folding with it (opens by itself while active). */
  parent?: string;
}

export interface NavSidebarProps {
  items: MaybeFn<readonly (NavSidebarItem | null | undefined | false)[] | null | undefined>;
  /** App name (bold) or any node; optional second line. */
  title?: unknown;
  subtitle?: unknown;
  /** Highlighted items at the top (e.g. a support inbox with a live count). */
  featured?: MaybeFn<readonly NavSidebarItem[] | null | undefined>;
  /** How many recent visits to show (default 5, 0 = off). */
  recent?: number;
  /** Category order: "alpha" (default, locale collation), "none" (as given) or explicit names first. */
  groupOrder?: "alpha" | "none" | readonly string[];
  /** Item order inside a category: "alpha" (default) or "none". */
  itemOrder?: "alpha" | "none";
  /** Icons next to category names (and the default icon of their items). */
  groupIcons?: Readonly<Record<string, unknown>>;
  /** Categories open on first visit: "active" (only the one with the current page, default), "all" or "none". */
  defaultOpen?: "active" | "all" | "none";
  placeholder?: MaybeFn<string | undefined>;
  /** Ctrl+K: focuses this search box ("focus", default) or belongs to a <CommandPalette> on the page ("palette": only the hint is
   *  shown here, the palette opens); false = no shortcut and no hint. */
  hotkey?: "focus" | "palette" | false;
  shortcut?: string;
  /** Collapse to an icon rail (button in the header; state persists). */
  collapsible?: boolean;
  footer?: unknown;
  /** localStorage key (default "m.sidebar"). */
  storageKey?: string;
  /** Starting width: px (number) or a CSS length ("18rem"). Default 17.5rem. */
  width?: number | string;
  /** A grip on the inner edge changes the width (drag, touch, ← → Home End on the focused grip, double click resets). */
  resizable?: boolean;
  /** Narrowest / widest width the grip allows, px (default 200 / 480). */
  minWidth?: number;
  maxWidth?: number;
  /** Called with the new width in px while resizing (and once it ends). */
  onResize?: (width: number) => void;
  /** Remember the width (default true when resizable): in the sidebar's storage, or under this localStorage key. */
  persist?: boolean | string;
  /** Dragging narrower than this (px) switches to the icon rail; dragging wider again restores the labels. */
  collapseBelow?: number;
  /** false: do not register the items with the command palette. */
  palette?: boolean;
  label?: MaybeFn<string | undefined>;
  /** The search box (default true); false also drops its shortcut. */
  search?: boolean;
  /** The "Recent" and "Categories" headings (default true); false also drops the expand / collapse all button. */
  headings?: boolean;
  /** The "Expand all" / "Collapse all" button beside the Categories heading (default true). */
  expandAll?: boolean;
  /** The item count beside each category name (default true). */
  groupCounts?: boolean;
  /** The category rows (default true). false: a two-level menu: the items of every listed category form one list, in
   *  category order (`groupOrder`), without the category names; "Expand all / Collapse all" then opens and closes the
   *  items that have pages under them. */
  groupHeads?: boolean;
  /** Nested items (a page under a page) also show their `sub` line (default false: only the label). */
  nestedSubs?: boolean;
  /** Only these categories are listed (a section of a large menu; reactive). The other items stay in the search, the recent list and the palette. */
  visibleGroups?: MaybeFn<readonly string[] | null | undefined>;
  /** Top-level rows: "md" (default) or "lg": equal, roomy rows (height `--m-sb-item-h`, 3.625rem) with the icon in a tinted tile, one line of description and the number of pages under them. */
  itemSize?: "md" | "lg";
  /** A row's text that does not fit: "scroll" (default: loops with a rest, on hover / focus and on the current row), "marquee" (flows one way without a rest while the row is hovered, focused, current or open) or "ellipsis" (cut). */
  subOverflow?: "scroll" | "marquee" | "ellipsis";
  /** Narrow screens: the edge the drawer of the menu comes from (default "start"; "bottom" = a bottom sheet). */
  sheetSide?: "start" | "end" | "bottom";
  /** The menu button of narrow screens (default true); false: open the drawer yourself with `open`. */
  menuButton?: boolean;
  /** Narrow screens: whether the drawer is open (controlled; with `onOpenChange`). */
  open?: MaybeFn<boolean | undefined>;
  onOpenChange?: (open: boolean) => void;
  /** Own texts (strings or accessors); defaults are the translated ones. `showUnder` / `hideUnder` name the fold button of a parent item. */
  labels?: {
    search?: MaybeFn<string>; clearSearch?: MaybeFn<string>; noMatches?: MaybeFn<string>; results?: MaybeFn<string>;
    recent?: MaybeFn<string>; categories?: MaybeFn<string>; expandAll?: MaybeFn<string>; collapseAll?: MaybeFn<string>;
    menu?: MaybeFn<string>; expandSidebar?: MaybeFn<string>; collapseSidebar?: MaybeFn<string>; resize?: MaybeFn<string>;
    showUnder?: (label: string) => string; hideUnder?: (label: string) => string;
  } | undefined;
  class?: ClassProp;
}

interface Saved { open?: unknown; recent?: unknown; rail?: unknown; width?: unknown }
const text = (x: MaybeFn<string | null | undefined> | undefined): string => String(val(x as MaybeFn<string>) ?? "");

/** Side menu: groups, search, recent and featured items, collapsible rail, resizable width, remembered state. */
export function NavSidebar(props: NavSidebarProps): Element {
  const storeKey = props.storageKey ?? "m.sidebar";
  const saved = load<Saved | null>(storeKey, {}) ?? {};
  const maxRecent = props.recent ?? 5;
  const items = computed(() => arr<NavSidebarItem | null | undefined | false>(val(props.items)).filter((x): x is NavSidebarItem => !!x && !val(x.hidden) && can(x.can)));
  const featured = computed(() => arr<NavSidebarItem>(val(props.featured)).filter((x) => !!x && !val(x.hidden) && can(x.can)));
  const byId = computed(() => new Map([...items(), ...featured()].map((x) => [x.id, x])));
  const firstVisit = !Array.isArray(saved.open);
  const open = signal(new Set(arr<string>(saved.open)));
  const recent = signal(arr<string>(saved.recent));
  const canRail = !!props.collapsible || props.collapseBelow != null;
  const rail = signal(canRail && saved.rail === true);
  // width (resizable): px; null = the CSS default / the `width` prop
  const minW = props.minWidth ?? 200, maxW = Math.max(props.maxWidth ?? 480, minW);
  const widthKey = typeof props.persist === "string" ? props.persist : null;
  const keepWidth = !!props.resizable && props.persist !== false;
  const savedW = keepWidth ? Number(widthKey ? load<unknown>(widthKey, null) : saved.width) : NaN;
  const width = signal<number | null>(Number.isFinite(savedW) && savedW > 0 ? clamp(savedW, minW, maxW) : null);
  const resizing = signal(false);
  const q = signal("");
  const chosen = signal<string | null>(null); // last onSelect item (items without href): active and remembered as a visit
  const persist = (): void => {
    save(storeKey, { open: [...open.peek()], recent: recent.peek(), ...(canRail ? { rail: rail.peek() } : {}), ...(keepWidth && !widthKey && width.peek() != null ? { width: width.peek() } : {}) });
    if (keepWidth && widthKey) save(widthKey, width.peek());
  };
  const navId = uid("m-sb");
  const lgItems = props.itemSize === "lg", flow = props.subOverflow === "marquee";
  type TextKey = Exclude<keyof NonNullable<NavSidebarProps["labels"]>, "showUnder" | "hideUnder">;
  const L = (k: TextKey, d: string): string => val(props.labels?.[k]) ?? d;
  // narrow screens: the menu opens in a Drawer from the menu button; the current row comes into view there too
  let showActive: (() => void) | undefined;
  const sheet = navDrawer({ id: navId, label: () => val(props.label) ?? t`Main`, menuLabel: () => L("menu", t`Menu`), icon: menu, side: props.sheetSide, class: () => cx("m-sb-sheet", props.sheetSide === "bottom" && "m-sb-sheet-bottom", props.nestedSubs && "is-nested-subs", lgItems && "is-lg-items"), onShow: () => showActive?.() });
  const drawer = sheet.open;
  // a controlled drawer: `open` moves it, every change (a choice, Escape, the scrim) is reported
  if (props.open !== undefined) effect(() => { const o = !!val(props.open); untrack(() => drawer.set(o)); });
  if (props.onOpenChange) { let was = drawer.peek(); effect(() => { const o = drawer(); if (o !== was) { was = o; untrack(() => props.onOpenChange?.(o)); } }); }
  const hasSearch = props.search !== false;
  let searchEl: HTMLInputElement | undefined, navEl: HTMLElement | undefined;

  // nested items: children by their parent's id (a parent that is not in the list leaves its children at the top)
  const kidsOf = computed(() => {
    const ids = new Set(items().map((x) => x.id)), m = new Map<string, NavSidebarItem[]>();
    for (const x of items()) if (x.parent && x.parent !== x.id && ids.has(x.parent)) { let l = m.get(x.parent); if (!l) m.set(x.parent, l = []); l.push(x); }
    return m;
  });
  const allGroups = computed(() => {
    const map = new Map<string, NavSidebarItem[]>();
    for (const x of items()) { const g = x.group ?? ""; if (!g || (x.parent && kidsOf().has(x.parent))) continue; let l = map.get(g); if (!l) map.set(g, l = []); l.push(x); }
    const byText = (a: NavSidebarItem, b: NavSidebarItem): number => compareText(text(a.label), text(b.label));
    let out = [...map].map(([name, list]) => ({ name, items: props.itemOrder === "none" ? list : [...list].sort(byText) }));
    const order = props.groupOrder ?? "alpha";
    if (order === "alpha") out = out.sort((a, b) => compareText(a.name, b.name));
    else if (Array.isArray(order)) out = out.sort((a, b) => { const i = order.indexOf(a.name), j = order.indexOf(b.name); return (i < 0 ? 1e9 : i) - (j < 0 ? 1e9 : j); });
    return out;
  });
  // a section of the menu: only the named categories are listed
  const groups = computed(() => { const only = val(props.visibleGroups); return only ? allGroups().filter((g) => only.includes(g.name)) : allGroups(); });
  const loose = computed(() => items().filter((x) => !x.group && !(x.parent && kidsOf().has(x.parent))));

  const active = computed(() => {
    const p = path();
    let best: { id: string; len: number } | null = null;
    for (const x of [...featured(), ...items()]) {
      const href = String(x.href ?? "").split("?")[0] ?? "";
      if (!href) continue;
      if ((p === href || (href !== "/" && p.startsWith(`${href}/`))) && (!best || href.length > best.len)) best = { id: x.id, len: href.length };
    }
    return best?.id ?? chosen();
  });
  const activeGroup = (): string | undefined => { const id = active(); return id ? byId().get(id)?.group : undefined; };
  /** Whether `id` is a child, grandchild… of `parent` (nested menus have any depth). */
  const under = (parent: string, id: string, depth = 0): boolean => depth < 8 && (kidsOf().get(parent) ?? []).some((k) => k.id === id || under(k.id, id, depth + 1));
  /** A parent's children show while it is opened, or by themselves while it or one of its descendants is the current page. */
  const kidsOpen = (id: string): boolean => {
    const s = open();
    if (s.has(`>${id}`)) return true;
    if (s.has(`<${id}`)) return false;
    const a = active();
    return a === id || (!!a && under(id, a));
  };
  const toggleKids = (id: string): void => {
    const to = !kidsOpen(id);
    open.update((s) => { const n = new Set(s); n.delete(`>${id}`); n.delete(`<${id}`); n.add(`${to ? ">" : "<"}${id}`); return n; });
    persist();
  };

  // first visit: open the requested categories; always open the category of the current page; remember visits
  if (firstVisit && props.defaultOpen === "all") open.set(new Set(untrack(allGroups).map((g) => g.name)));
  effect(() => {
    const id = active();
    untrack(() => {
      drawer.set(false);
      if (id == null) return;
      const g = byId.peek().get(id)?.group;
      if (g && !open.peek().has(g) && props.defaultOpen !== "none") open.update((s) => new Set(s).add(g));
      if (maxRecent > 0) {
        const next = [id, ...recent.peek().filter((x) => x !== id)].slice(0, maxRecent + 1);
        if (next.join("\n") !== recent.peek().join("\n")) recent.set(next);
      }
      persist();
    });
  });
  // the active row comes into view when it is outside the menu's scroll area (like scrollIntoView block "nearest", but
  // only the menu scrolls: never the page, nor an off-canvas drawer). The menu otherwise keeps its scroll position.
  let revealed = false;
  effect(() => {
    const id = active();
    if (id == null) return;
    const move = revealed && !reducedMotion();
    revealed = true;
    const show = (smooth: boolean): void => {
      const all = [...(navEl?.querySelectorAll<HTMLElement>(".m-sb-scroll .m-sb-item") ?? [])].filter((r) => r.dataset["id"] === id && !r.closest("[inert]"));
      const el = all.find((r) => r.dataset["where"] !== "recent") ?? all[0];
      scrollIntoArea(el, el?.closest<HTMLElement>(".m-sb-scroll"), { smooth });
    };
    showActive = () => show(false);
    queueMicrotask(() => show(move));
  });
  if (props.palette !== false) registerPages(() => items().filter((x) => x.href).map((x) => ({ id: x.id, title: text(x.label), href: x.href as Href, group: x.group, keywords: x.keywords, icon: x.icon })));
  const hk = hasSearch ? props.hotkey ?? "focus" : false;
  // "focus": the shortcut focuses this search box. "palette": the <CommandPalette> owns the shortcut; the box only shows the hint
  if (hk === "focus") hotkey(props.shortcut ?? "mod+k", () => { if (rail.peek()) { rail.set(false); persist(); } drawer.set(true); queueMicrotask(() => searchEl?.focus()); }, { inInputs: true, description: () => L("search", t`Search the menu`) });

  const toggle = (g: string, to?: boolean): void => {
    open.update((s) => { const n = new Set(s); if (to ?? !n.has(g)) n.add(g); else n.delete(g); return n; });
    persist();
  };
  // groupHeads={false}: no category rows; "all" means the items with pages under them
  const flat = props.groupHeads === false;
  const parents = (): NavSidebarItem[] => groups().flatMap((g) => g.items).filter((x) => kidsOf().has(x.id));
  const allOpen = (): boolean => (flat ? parents().length > 0 && parents().every((x) => kidsOpen(x.id)) : groups().length > 0 && groups().every((g) => open().has(g.name)));
  const setAll = (on: boolean): void => {
    if (flat) {
      const ids = untrack(parents).map((x) => x.id);
      open.update((s) => { const n = new Set(s); for (const id of ids) { n.delete(`>${id}`); n.delete(`<${id}`); n.add(`${on ? ">" : "<"}${id}`); } return n; });
      persist();
      return;
    }
    const names = groups.peek().map((g) => g.name);
    // a section: only its categories change, the others keep their state
    if (val(props.visibleGroups)) open.update((s) => { const n = new Set(s); for (const g of names) { if (on) n.add(g); else n.delete(g); } return n; });
    else open.set(on ? new Set(names) : new Set());
    persist();
  };

  // ---- rows
  const badge = (x: NavSidebarItem): unknown => {
    const b = val(x.badge);
    if (b == null || b === 0 || b === "") return null;
    const tone = x.badgeTone ?? (typeof b === "number" ? "danger" : "neutral");
    const look = { class: "m-sb-badge", tone, variant: tone === "primary" ? "solid" as const : undefined };
    return typeof b === "number" ? h(Badge, { ...look, count: b }) : h(Badge, look, b);
  };
  const row = (x: NavSidebarItem, where: string, sub?: () => string): Element => {
    const kids = where === "group" || where === "main" || where === "child" ? kidsOf().get(x.id) : undefined;
    const count = lgItems && kids?.length && where !== "child" && props.groupCounts !== false ? h("span", { class: "m-sb-count" }, String(kids.length)) : undefined;
    const el = h(ListRow, {
      class: () => cx("m-sb-row", "m-sb-item", active() !== x.id && !!active() && under(x.id, active()!) && "is-active-parent"), "data-id": x.id, "data-where": where,
      lead: x.icon ?? (x.group ? props.groupIcons?.[x.group] : undefined), title: () => text(x.label), sub: sub ?? (x.sub !== undefined ? () => text(x.sub) : undefined),
      trail: x.badge !== undefined ? () => badge(x) : count, marquee: { mode: "loop" }, active: () => active() === x.id, indicator: where !== "featured",
      // "marquee": the text flows one way without a rest while the row is hovered, focused, current or open
      ...(flow ? { marquee: { mode: "loop", pause: 0, speed: 28, separator: "", play: () => active() === x.id || (!!kids?.length && kidsOpen(x.id)) } } : {}),
      overflow: props.subOverflow === "ellipsis" ? "ellipsis" : undefined,
      tooltip: () => (rail() ? text(x.label) : null), "aria-current": () => (active() === x.id ? "page" : null),
      ...(x.href && !x.onSelect ? { href: x.href } : { onClick: () => { if (!x.href) chosen.set(x.id); x.onSelect?.(); if (x.href) void navigate(x.href); } }),
    });
    if (!kids?.length) return h("li", { class: "m-sb-li" }, el);
    const kid = uid("m-sbk");
    return h("li", { class: () => cx("m-sb-li", "is-parent", kidsOpen(x.id) && "is-kids-open") },
      el,
      h(IconButton, { class: "m-sb-kids-btn", size: "xs", icon: h(Chevron, {}), title: false, tabindex: "-1", "aria-expanded": () => String(kidsOpen(x.id)), "aria-controls": kid,
        label: () => (kidsOpen(x.id) ? props.labels?.hideUnder?.(text(x.label)) ?? t`Hide pages under ${text(x.label)}` : props.labels?.showUnder?.(text(x.label)) ?? t`Show pages under ${text(x.label)}`), onClick: () => toggleKids(x.id) }),
      h("div", { class: "m-sb-kids", id: kid, inert: () => !kidsOpen(x.id) },
        h("ul", { class: "m-sb-list m-sb-sublist" }, kids.map((k) => row(k, "child")))));
  };
  const sectionHead = (label: () => string, ic: unknown, extra?: unknown): Element | null => props.headings === false ? null :
    h(SectionLabel, { class: "m-sb-section", icon: ic, label, actions: extra ?? undefined }) as Element;

  const queryText = computed(() => q().trim()); // spaces alone do not rebuild the menu
  const body = (): unknown => {
    const query = queryText();
    if (query) {
      const hits = untrack(() => rank(query, items(), (x) => ({ title: text(x.label), keywords: [x.keywords, x.group, text(x.sub)].filter(Boolean).join(" ") })));
      if (!hits.length) return h(Empty, { size: "sm", class: "m-sb-none", title: () => L("noMatches", t`No matches`) });
      return untrack(() => h("ul", { class: "m-sb-list", "aria-label": L("results", t`Results`) }, hits.map((r) => row(r.item, "search", () => r.item.group ?? text(r.item.sub)))));
    }
    // Each block is its own reactive region: a navigation changes `recent` (and `active`), which rebuilds only the
    // recent block, never the categories (a rebuilt menu loses its scroll position and looks reloaded).
    const recentBlock = (): unknown => {
      const f = featured(), m = byId();
      const rec = recent().map((id) => m.get(id)).filter((x): x is NavSidebarItem => !!x && !f.some((y) => y.id === x.id)).slice(0, maxRecent);
      return untrack(() => rec.length > 0 && h("div", { class: "m-sb-block m-sb-recent" },
        sectionHead(() => L("recent", t`Recent`), clock),
        h("ul", { class: "m-sb-list" }, rec.map((x) => row(x, "recent", () => x.group ?? text(x.sub))))));
    };
    return [
      () => { const f = featured(); return untrack(() => f.length > 0 && h("ul", { class: "m-sb-list m-sb-featured" }, f.map((x) => row(x, "featured")))); },
      () => { const ls = loose(); return untrack(() => ls.length > 0 && h("ul", { class: "m-sb-list m-sb-loose" }, ls.map((x) => row(x, "main")))); },
      maxRecent > 0 && recentBlock,
      () => { const gs = groups(); return untrack(() => gs.length > 0 && h("div", { class: "m-sb-block m-sb-cats" },
        sectionHead(() => L("categories", t`Categories`), null, props.expandAll === false ? null : h(Button, { variant: "link", class: "m-sb-all", onClick: () => setAll(!allOpen()) }, () => (allOpen() ? L("collapseAll", t`Collapse all`) : L("expandAll", t`Expand all`)))),
        flat ? h("ul", { class: "m-sb-list m-sb-gitems m-sb-flat" }, gs.flatMap((g) => g.items.map((x) => row(x, "group")))) : h("ul", { class: "m-sb-list m-sb-groups" }, gs.map((g) => {
          const gid = uid("m-sbg");
          const isOpen = (): boolean => rail() || open().has(g.name);
          return h("li", { class: () => cx("m-sb-group", isOpen() && "is-open", activeGroup() === g.name && "is-active-group") },
            h(ListRow, { class: "m-sb-row m-sb-gbtn", "data-group": g.name, "aria-expanded": () => String(isOpen()), "aria-controls": gid, onClick: () => toggle(g.name),
              lead: [h(Chevron, { class: "m-sb-chev" }), icon(props.groupIcons?.[g.name], "m-icon m-sb-gicon")], title: g.name, marquee: { mode: "loop" },
              trail: props.groupCounts === false ? undefined : h("span", { class: "m-sb-count" }, String(g.items.length)) }),
            h("div", { class: "m-sb-gpanel", id: gid, inert: () => !isOpen() },
              h("ul", { class: "m-sb-list m-sb-gitems" }, g.items.map((x) => row(x, "group")))));
        })))); },
    ];
  };

  // ---- keyboard: roving focus over visible rows
  const rows = (): HTMLElement[] => [...(navEl?.querySelectorAll<HTMLElement>(".m-sb-row") ?? [])].filter((r) => !r.closest("[inert]"));
  // keys of the search box (its own Escape clears the query)
  const onSearchKey = (e: KeyboardEvent): void => {
    if (e.key === "ArrowDown") { e.preventDefault(); rows()[0]?.focus(); }
    else if (e.key === "Enter" && q.peek().trim()) { e.preventDefault(); rows()[0]?.click(); }
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.defaultPrevented) return; // handled once (nested handlers / delegation)
    const target = e.target as HTMLElement;
    if (!target.classList.contains("m-sb-row")) return;
    const list = rows(), i = list.indexOf(target);
    // ↑ on the first row goes back to the search box; ↑ ↓ Home End otherwise move among the rows
    if (e.key === "ArrowUp" && i === 0) { e.preventDefault(); searchEl?.focus(); return; }
    if (roving(e, list, { wrap: false })) return;
    // nested items: → opens a parent's children, ← closes them, or goes from a child back to its parent
    if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && target.closest(".is-parent, .m-sb-sublist")) {
      const li = target.parentElement, id = target.dataset["id"] ?? "";
      if (li?.classList.contains("is-parent") && target.dataset["where"] !== "child") {
        if (e.key === "ArrowRight") { e.preventDefault(); if (!kidsOpen(id)) toggleKids(id); else list[i + 1]?.focus(); return; }
        if (kidsOpen(id)) { e.preventDefault(); toggleKids(id); return; }
      } else if (e.key === "ArrowLeft") {
        const up = target.closest(".is-parent")?.querySelector<HTMLElement>(":scope > .m-sb-row");
        if (up) { e.preventDefault(); up.focus(); return; }
      }
      if (e.key === "ArrowRight") return;
      const g = target.closest(".m-sb-group")?.querySelector<HTMLElement>(".m-sb-gbtn");
      if (g) { e.preventDefault(); g.focus(); }
    }
    else if (e.key === "ArrowRight" && target.dataset["group"]) { e.preventDefault(); if (!open.peek().has(target.dataset["group"])) toggle(target.dataset["group"], true); else list[i + 1]?.focus(); }
    else if (e.key === "ArrowLeft") {
      const g = target.dataset["group"] ?? target.closest(".m-sb-group")?.querySelector<HTMLElement>(".m-sb-gbtn")?.dataset["group"];
      if (!g) return;
      e.preventDefault();
      if (target.dataset["group"]) toggle(g, false); else target.closest(".m-sb-group")?.querySelector<HTMLElement>(".m-sb-gbtn")?.focus();
    }
  };

  // ---- width: a CSS variable on the wrapper (CSSOM, no inline style attribute)
  let wrapEl: HTMLElement | undefined;
  const cssWidth = (): string | null => { const w = width(); return w != null ? `${w}px` : props.width == null ? null : typeof props.width === "number" ? `${props.width}px` : props.width; };
  effect(() => { const w = cssWidth(); if (wrapEl) { if (w) wrapEl.style.setProperty("--m-sb-w", w); else wrapEl.style.removeProperty("--m-sb-w"); } });
  const currentPx = (): number => width.peek() ?? Math.round(navEl?.getBoundingClientRect().width || 280);
  const setWidth = (px: number, done = false): void => {
    if (props.collapseBelow != null) {
      if (px < props.collapseBelow) { if (!rail.peek()) { rail.set(true); persist(); } return; }
      if (rail.peek()) rail.set(false);
    }
    const w = Math.round(clamp(px, minW, maxW));
    width.set(w);
    props.onResize?.(w);
    if (done) persist();
  };
  // drag / arrows (RTL mirrored) / Home / End / Enter or double click resets: ResizeHandle. The range goes below minW
  // when the sidebar can fold to its rail (setWidth folds it under collapseBelow).
  const grip = (): unknown => !props.resizable ? null : h(ResizeHandle, {
    class: () => cx("m-sb-resize", resizing() && "is-dragging"), "aria-controls": navId, label: () => L("resize", t`Resize sidebar`),
    value: currentPx, min: props.collapseBelow != null ? 0 : minW, max: maxW, step: 16,
    set: (to: number, done?: boolean) => { if (rail.peek() && to > currentPx()) rail.set(false); setWidth(to, done); },
    reset: () => { width.set(null); if (rail.peek() && props.collapseBelow != null) rail.set(false); persist(); props.onResize?.(currentPx()); },
    onStart: () => { globalThis.document.documentElement.classList.add("m-sb-resizing"); resizing.set(true); },
    onEnd: () => { globalThis.document.documentElement.classList.remove("m-sb-resizing"); resizing.set(false); },
  });
  const title = props.title; // read once: a node prop is built when it is read
  const railLabel = (): string => (rail() ? L("expandSidebar", t`Expand sidebar`) : L("collapseSidebar", t`Collapse sidebar`));
  return h("div", { class: () => cx("m-nav-wrap", "m-sb-wrap", drawer() && "is-open", rail() && "is-rail", props.resizable && "is-resizable", props.nestedSubs && "is-nested-subs", lgItems && "is-lg-items", val(props.class)), ref: (x: HTMLElement) => { wrapEl = x; const w = cssWidth(); if (w) x.style.setProperty("--m-sb-w", w); } },
    props.menuButton === false ? null : sheet.burger,
    sheet.place(h("nav", { class: "m-nav m-sb", id: navId, ref: (x: HTMLElement) => { navEl = x; }, "aria-label": () => val(props.label) ?? t`Main`, onKeydown: onKey },
      h("div", { class: "m-sb-head" },
        (title != null || props.collapsible) && h(PanelHeader, { as: "div", class: "m-sb-titlebar", title: title ?? undefined, titleAs: "span", subtitle: props.subtitle ?? undefined,
          actions: props.collapsible ? h(IconButton, { class: "m-nav-rail-btn", size: "sm", icon: panelLeft, "aria-pressed": () => String(rail()), label: railLabel, onClick: () => { rail.update((x) => !x); persist(); } }) : undefined }),
        hasSearch && h(SearchBox, {
          class: "m-sb-search", inputClass: "m-sb-input", value: q, debounce: 0, inputRef: (x: HTMLInputElement) => { searchEl = x; if (hk) x.setAttribute("aria-keyshortcuts", "Control+K Meta+K"); },
          placeholder: () => val(props.placeholder) ?? t`Search or ask…`, label: () => val(props.labels?.search) ?? val(props.placeholder) ?? t`Search the menu`,
          clearLabel: () => L("clearSearch", t`Clear search`), shortcutHint: hk ? props.shortcut ?? "mod+k" : false, onKeyDown: onSearchKey,
        })),
      h("div", { class: "m-sb-scroll" }, body),
      props.footer != null && h("div", { class: "m-nav-foot m-sb-foot" }, props.footer),
      grip())));
}
