// NavSidebar: a rich application sidebar — title, search box ("Search or ask…", Ctrl+K), featured items with live badges,
// recently visited items, and collapsible categories with counts ("expand / collapse all"). Keyboard: ↑ ↓ Home End move
// between rows, → opens and ← closes a category (← on an item goes to its category), Enter activates, typing filters.
// Remembers open categories and recent visits (localStorage); icon rail mode; drawer with a menu button on small screens.
import "./sidebar.css";
import "./nav.css";
import "./button.css";
import "./display.css";
import { signal, computed, effect, untrack, onCleanup } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { Link, path, navigate, type Href } from "../router/index.ts";
import { can, type PermCheck } from "../access/index.ts";
import { rank } from "./fold.ts";
import { OverflowText } from "./marquee.ts";
import { compareText } from "../core/text.ts";
import { registerPages } from "./registry.ts";
import { key as hotkey, formatKey } from "./keys.ts";
import { val, cx, uid, icon, glyph, load, save, on, type MaybeFn, type ClassProp } from "./util.ts";
import { menu } from "../icons/glyphs/menu.ts";
import { search as searchIcon } from "../icons/glyphs/search.ts";
import { chevronRight } from "../icons/glyphs/chevronRight.ts";
import { clock } from "../icons/glyphs/clock.ts";
import { panelLeft } from "../icons/glyphs/panelLeft.ts";
import { x as xIcon } from "../icons/glyphs/x.ts";

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
  /** localStorage key (default "hm.sidebar"). */
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
  class?: ClassProp;
}

interface Saved { open?: unknown; recent?: unknown; rail?: unknown; width?: unknown }
const arr = <T>(x: unknown): T[] => (Array.isArray(x) ? x as T[] : []);
const text = (x: MaybeFn<string | null | undefined> | undefined): string => String(val(x as MaybeFn<string>) ?? "");

export function NavSidebar(props: NavSidebarProps): Element {
  const storeKey = props.storageKey ?? "hm.sidebar";
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
  const width = signal<number | null>(Number.isFinite(savedW) && savedW > 0 ? Math.max(minW, Math.min(maxW, savedW)) : null);
  const resizing = signal(false);
  const shownWidth = signal(0); // rendered width (aria-valuenow when no width was set)
  const drawer = signal(false);
  const q = signal("");
  const chosen = signal<string | null>(null); // last onSelect item (items without href): active and remembered as a visit
  const persist = (): void => {
    save(storeKey, { open: [...open.peek()], recent: recent.peek(), ...(canRail ? { rail: rail.peek() } : {}), ...(keepWidth && !widthKey && width.peek() != null ? { width: width.peek() } : {}) });
    if (keepWidth && widthKey) save(widthKey, width.peek());
  };
  const navId = uid("hm-sb");
  let searchEl: HTMLInputElement | undefined, navEl: HTMLElement | undefined;

  const groups = computed(() => {
    const map = new Map<string, NavSidebarItem[]>();
    for (const x of items()) { const g = x.group ?? ""; if (!g) continue; let l = map.get(g); if (!l) map.set(g, l = []); l.push(x); }
    const byText = (a: NavSidebarItem, b: NavSidebarItem): number => compareText(text(a.label), text(b.label));
    let out = [...map].map(([name, list]) => ({ name, items: props.itemOrder === "none" ? list : [...list].sort(byText) }));
    const order = props.groupOrder ?? "alpha";
    if (order === "alpha") out = out.sort((a, b) => compareText(a.name, b.name));
    else if (Array.isArray(order)) out = out.sort((a, b) => { const i = order.indexOf(a.name), j = order.indexOf(b.name); return (i < 0 ? 1e9 : i) - (j < 0 ? 1e9 : j); });
    return out;
  });
  const loose = computed(() => items().filter((x) => !x.group));

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

  // first visit: open the requested categories; always open the category of the current page; remember visits
  if (firstVisit && props.defaultOpen === "all") open.set(new Set(untrack(groups).map((g) => g.name)));
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
  if (props.palette !== false) registerPages(() => items().filter((x) => x.href).map((x) => ({ id: x.id, title: text(x.label), href: x.href as Href, group: x.group, keywords: x.keywords, icon: x.icon })));
  const hk = props.hotkey ?? "focus";
  // "focus": the shortcut focuses this search box. "palette": the <CommandPalette> owns the shortcut; the box only shows the hint
  if (hk === "focus") hotkey(props.shortcut ?? "mod+k", () => { if (rail.peek()) { rail.set(false); persist(); } drawer.set(true); queueMicrotask(() => searchEl?.focus()); }, { inInputs: true, description: () => t`Search the menu` });
  on<KeyboardEvent>(globalThis.document, "keydown", (e) => { if (e.key === "Escape" && drawer.peek()) drawer.set(false); });

  const toggle = (g: string, to?: boolean): void => {
    open.update((s) => { const n = new Set(s); if (to ?? !n.has(g)) n.add(g); else n.delete(g); return n; });
    persist();
  };
  const allOpen = (): boolean => groups().length > 0 && groups().every((g) => open().has(g.name));
  const setAll = (on: boolean): void => { open.set(on ? new Set(groups.peek().map((g) => g.name)) : new Set()); persist(); };

  // ---- rows
  const badge = (x: NavSidebarItem): unknown => x.badge !== undefined && (() => {
    const b = val(x.badge);
    if (b == null || b === 0 || b === "") return null;
    const n = typeof b === "number" ? (b > 99 ? "99+" : String(b)) : b;
    return h("span", { class: cx("hm-sb-badge", `hm-sb-badge-${x.badgeTone ?? (typeof b === "number" ? "danger" : "neutral")}`) }, n);
  });
  const row = (x: NavSidebarItem, where: string, sub?: () => string): Element => {
    const iconOf = x.icon ?? (x.group ? props.groupIcons?.[x.group] : undefined);
    const body = [
      icon(iconOf, "hm-icon hm-sb-icon"),
      h("span", { class: "hm-sb-text" },
        h(OverflowText, { class: "hm-sb-label", text: () => text(x.label), play: () => active() === x.id }),
        () => { const s = sub ? sub() : text(x.sub); return s ? h(OverflowText, { class: "hm-sb-sub", play: () => active() === x.id }, s) : null; }),
      badge(x),
    ];
    const common = {
      class: () => cx("hm-sb-row", "hm-sb-item", active() === x.id && "is-active"), "data-id": x.id, "data-where": where,
      title: () => (rail() ? text(x.label) : null), "aria-current": () => (active() === x.id ? "page" : null),
    };
    const el = x.href && !x.onSelect
      ? h(Link, { ...common, href: x.href, children: body })
      : h("button", { ...common, type: "button", onClick: () => { if (!x.href) chosen.set(x.id); x.onSelect?.(); if (x.href) void navigate(x.href); } }, body);
    return h("li", { class: "hm-sb-li" }, el);
  };
  const sectionHead = (label: () => string, ic: unknown, extra?: unknown): Element =>
    h("div", { class: "hm-sb-section" }, icon(ic, "hm-icon hm-sb-section-icon"), h("span", { class: "hm-sb-section-label" }, label), extra ?? null);

  const body = (): unknown => {
    const query = q().trim();
    if (query) {
      const hits = untrack(() => rank(query, items(), (x) => ({ title: text(x.label), keywords: [x.keywords, x.group, text(x.sub)].filter(Boolean).join(" ") })));
      if (!hits.length) return h("p", { class: "hm-sb-none" }, () => t`No matches`);
      return untrack(() => h("ul", { class: "hm-sb-list", "aria-label": t`Results` }, hits.map((r) => row(r.item, "search", () => r.item.group ?? text(r.item.sub)))));
    }
    const f = featured(), m = byId();
    const rec = recent().map((id) => m.get(id)).filter((x): x is NavSidebarItem => !!x && !f.some((y) => y.id === x.id)).slice(0, maxRecent);
    const gs = groups(), ls = loose();
    return untrack(() => [
      f.length > 0 && h("ul", { class: "hm-sb-list hm-sb-featured" }, f.map((x) => row(x, "featured"))),
      ls.length > 0 && h("ul", { class: "hm-sb-list hm-sb-loose" }, ls.map((x) => row(x, "main"))),
      maxRecent > 0 && rec.length > 0 && h("div", { class: "hm-sb-block hm-sb-recent" },
        sectionHead(() => t`Recent`, clock),
        h("ul", { class: "hm-sb-list" }, rec.map((x) => row(x, "recent", () => x.group ?? text(x.sub))))),
      gs.length > 0 && h("div", { class: "hm-sb-block hm-sb-cats" },
        sectionHead(() => t`Categories`, null, h("button", { type: "button", class: "hm-sb-all", onClick: () => setAll(!allOpen()) }, () => (allOpen() ? t`Collapse all` : t`Expand all`))),
        h("ul", { class: "hm-sb-list hm-sb-groups" }, gs.map((g) => {
          const gid = uid("hm-sbg");
          const isOpen = (): boolean => rail() || open().has(g.name);
          return h("li", { class: () => cx("hm-sb-group", isOpen() && "is-open", activeGroup() === g.name && "has-active") },
            h("button", { type: "button", class: "hm-sb-row hm-sb-gbtn", "data-group": g.name, "aria-expanded": () => String(isOpen()), "aria-controls": gid, onClick: () => toggle(g.name) },
              h("span", { class: "hm-sb-chev", "aria-hidden": "true" }, glyph(chevronRight)),
              icon(props.groupIcons?.[g.name], "hm-icon hm-sb-gicon"),
              h(OverflowText, { class: "hm-sb-gname" }, g.name),
              h("span", { class: "hm-sb-count" }, String(g.items.length))),
            h("div", { class: "hm-sb-gpanel", id: gid, inert: () => !isOpen() },
              h("ul", { class: "hm-sb-list hm-sb-gitems" }, g.items.map((x) => row(x, "group")))));
        }))),
    ]);
  };

  // ---- keyboard: roving focus over visible rows
  const rows = (): HTMLElement[] => [...(navEl?.querySelectorAll<HTMLElement>(".hm-sb-row") ?? [])].filter((r) => !r.closest("[inert]"));
  const onKey = (e: KeyboardEvent): void => {
    if (e.defaultPrevented) return; // handled once (nested handlers / delegation)
    const target = e.target as HTMLElement;
    if (target === searchEl) {
      if (e.key === "ArrowDown") { e.preventDefault(); rows()[0]?.focus(); }
      else if (e.key === "Escape" && q.peek()) { e.preventDefault(); e.stopPropagation(); q.set(""); if (searchEl) searchEl.value = ""; }
      else if (e.key === "Enter" && q.peek().trim()) { e.preventDefault(); rows()[0]?.click(); }
      return;
    }
    if (!target.classList.contains("hm-sb-row")) return;
    const list = rows(), i = list.indexOf(target);
    const go = (j: number): void => { e.preventDefault(); list[Math.max(0, Math.min(list.length - 1, j))]?.focus(); };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") { if (i === 0) { e.preventDefault(); searchEl?.focus(); } else go(i - 1); }
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(list.length - 1);
    else if (e.key === "ArrowRight" && target.dataset["group"]) { e.preventDefault(); if (!open.peek().has(target.dataset["group"])) toggle(target.dataset["group"], true); else list[i + 1]?.focus(); }
    else if (e.key === "ArrowLeft") {
      const g = target.dataset["group"] ?? target.closest(".hm-sb-group")?.querySelector<HTMLElement>(".hm-sb-gbtn")?.dataset["group"];
      if (!g) return;
      e.preventDefault();
      if (target.dataset["group"]) toggle(g, false); else target.closest(".hm-sb-group")?.querySelector<HTMLElement>(".hm-sb-gbtn")?.focus();
    }
  };

  const kbd = props.shortcut ?? "mod+k";

  // ---- width: a CSS variable on the wrapper (CSSOM, no inline style attribute)
  let wrapEl: HTMLElement | undefined;
  const cssWidth = (): string | null => { const w = width(); return w != null ? `${w}px` : props.width == null ? null : typeof props.width === "number" ? `${props.width}px` : props.width; };
  effect(() => { const w = cssWidth(); if (wrapEl) { if (w) wrapEl.style.setProperty("--hm-sb-w", w); else wrapEl.style.removeProperty("--hm-sb-w"); } });
  const currentPx = (): number => width.peek() ?? Math.round(navEl?.getBoundingClientRect().width || 280);
  const setWidth = (px: number, done = false): void => {
    if (props.collapseBelow != null) {
      if (px < props.collapseBelow) { if (!rail.peek()) { rail.set(true); persist(); } return; }
      if (rail.peek()) rail.set(false);
    }
    const w = Math.round(Math.max(minW, Math.min(maxW, px)));
    width.set(w);
    props.onResize?.(w);
    if (done) persist();
  };
  const rtl = (): boolean => (navEl ? globalThis.getComputedStyle?.(navEl).direction === "rtl" : false);
  if (props.resizable && typeof globalThis.ResizeObserver === "function") {
    const ro = new ResizeObserver(() => { if (navEl) shownWidth.set(Math.round(navEl.getBoundingClientRect().width)); });
    queueMicrotask(() => { if (navEl) ro.observe(navEl); });
    onCleanup(() => ro.disconnect());
  }
  const grip = (): unknown => !props.resizable ? null : h("div", {
    class: () => cx("hm-sb-resize", resizing() && "is-dragging"), role: "separator", tabindex: "0", "aria-orientation": "vertical", "aria-controls": navId,
    "aria-label": () => t`Resize sidebar`, "aria-valuemin": String(minW), "aria-valuemax": String(maxW), "aria-valuenow": () => String(width() ?? shownWidth()),
    onPointerdown: (e: PointerEvent) => {
      if (e.button > 0) return;
      e.preventDefault();
      const handle = e.currentTarget as HTMLElement;
      handle.setPointerCapture?.(e.pointerId);
      const doc = globalThis.document.documentElement;
      doc.classList.add("hm-sb-resizing");
      resizing.set(true);
      const edge = navEl?.getBoundingClientRect();
      const move = (ev: PointerEvent): void => { if (edge) setWidth(rtl() ? edge.right - ev.clientX : ev.clientX - edge.left); };
      const up = (): void => {
        handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); handle.removeEventListener("pointercancel", up);
        doc.classList.remove("hm-sb-resizing"); resizing.set(false); persist(); if (width.peek() != null) props.onResize?.(width.peek() as number);
      };
      handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", up); handle.addEventListener("pointercancel", up);
    },
    onDblclick: () => { width.set(null); if (rail.peek() && props.collapseBelow != null) rail.set(false); persist(); props.onResize?.(currentPx()); },
    onKeydown: (e: KeyboardEvent) => {
      const step = e.shiftKey ? 64 : 16, grow = rtl() ? "ArrowLeft" : "ArrowRight", shrink = rtl() ? "ArrowRight" : "ArrowLeft";
      const to = e.key === grow ? currentPx() + step : e.key === shrink ? currentPx() - step : e.key === "Home" ? minW : e.key === "End" ? maxW : null;
      if (to == null) return;
      e.preventDefault();
      if (rail.peek() && to > currentPx()) rail.set(false);
      setWidth(to, true);
    },
  });
  return h("div", { class: () => cx("hm-nav-wrap", "hm-sb-wrap", drawer() && "is-open", rail() && "is-rail", props.resizable && "is-resizable", val(props.class)), ref: (x: HTMLElement) => { wrapEl = x; const w = cssWidth(); if (w) x.style.setProperty("--hm-sb-w", w); } },
    h("button", { type: "button", class: "hm-icon-btn hm-nav-burger", "aria-controls": navId, "aria-expanded": () => String(drawer()), "aria-label": () => t`Menu`, onClick: () => drawer.update((x) => !x) }, glyph(menu)),
    h("div", { class: "hm-nav-scrim", "aria-hidden": "true", onClick: () => drawer.set(false) }),
    h("nav", { class: "hm-nav hm-sb", id: navId, ref: (x: HTMLElement) => { navEl = x; }, "aria-label": () => val(props.label) ?? t`Main`, onKeydown: onKey },
      h("div", { class: "hm-sb-head" },
        h("div", { class: "hm-sb-titlebar" },
          props.title != null && h("div", { class: "hm-sb-title" }, h("span", { class: "hm-sb-title-main" }, props.title), props.subtitle != null && h("span", { class: "hm-sb-title-sub" }, props.subtitle)),
          props.collapsible && h("button", { type: "button", class: "hm-icon-btn hm-btn-sm hm-nav-rail-btn", "aria-pressed": () => String(rail()),
            "aria-label": () => (rail() ? t`Expand sidebar` : t`Collapse sidebar`), title: () => (rail() ? t`Expand sidebar` : t`Collapse sidebar`),
            onClick: () => { rail.update((x) => !x); persist(); } }, glyph(panelLeft))),
        h("div", { class: "hm-sb-search", role: "search" },
          h("span", { class: "hm-sb-search-icon", "aria-hidden": "true" }, glyph(searchIcon)),
          h("input", {
            type: "search", class: "hm-sb-input", ref: (x: HTMLInputElement) => { searchEl = x; }, autocomplete: "off", spellcheck: "false",
            placeholder: () => val(props.placeholder) ?? t`Search or ask…`, "aria-label": () => val(props.placeholder) ?? t`Search the menu`,
            "aria-keyshortcuts": hk ? "Control+K Meta+K" : null, onInput: (e: Event) => q.set((e.target as HTMLInputElement).value),
          }),
          () => (q() ? h("button", { type: "button", class: "hm-sb-clear", "aria-label": () => t`Clear search`, onClick: () => { q.set(""); if (searchEl) { searchEl.value = ""; searchEl.focus(); } } }, glyph(xIcon))
            : hk ? h("kbd", { class: "hm-kbd hm-sb-kbd", "aria-hidden": "true" }, formatKey(kbd)) : null))),
      h("div", { class: "hm-sb-scroll" }, body),
      props.footer != null && h("div", { class: "hm-nav-foot hm-sb-foot" }, props.footer),
      grip()));
}
