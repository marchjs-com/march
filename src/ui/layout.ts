// Page scaffolding: Page, Section, ListDetail, Pager, SearchBox.
import "./crumbs.css";
import "./layout.css";
import "./field.css";
import "./button.css";
import { signal, computed, untrack, effect, onCleanup, type Signal } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { Link, back as historyBack, type Href } from "../router/router.ts";
import { actionsOf } from "./display-base.ts";
import { type ActionsProp } from "./display.ts";
import { Tabs, type TabSpec } from "./tabs.ts";
import { key } from "./keys.ts";
import { val, cx, rest, debounce, glyph, type MaybeFn, type ClassProp } from "./util.ts";
import { Layout, useLayout, addControls, resolveFeatures, type LayoutProps, type SlotName } from "../components/layout/layout/index.ts";
import { CORNERS } from "../components/layout/bottom-right-controls/index.ts";
import { arrowLeft } from "../icons/glyphs/arrowLeft.ts";
import { search as searchIcon } from "../icons/glyphs/search.ts";
import { x as xIcon } from "../icons/glyphs/x.ts";
import { chevronLeft } from "../icons/glyphs/chevronLeft.ts";
import { chevronRight } from "../icons/glyphs/chevronRight.ts";

/** A breadcrumb; the last one is the current page. */
export interface Breadcrumb { label: MaybeFn<string>; href?: Href }
export interface PageProps extends Pick<LayoutProps, "corners" | "features"> {
  title: MaybeFn<unknown>;
  /** Region content of the surrounding Layout while this page is shown, e.g. `{ aside: <Filters/> }`. */
  layout?: Partial<Pick<LayoutProps, "top" | "header" | "nav" | "aside" | "footer">> | undefined;
  /** Write the title to the document (through the Layout's titleTemplate). Default true. */
  documentTitle?: boolean | undefined;
  subtitle?: MaybeFn<unknown>;
  actions?: ActionsProp;
  breadcrumbs?: MaybeFn<readonly Breadcrumb[] | null | undefined>;
  /** A path (Link), `true` (history back) or a function. */
  back?: Href | true | (() => unknown);
  tabs?: MaybeFn<readonly TabSpec[] | null | undefined>;
  /** Keep the active tab in this query parameter. */
  tabsQuery?: string;
  narrow?: boolean;
  class?: ClassProp;
  children?: unknown;
  [attr: string]: unknown;
}

/**
 * `<Page title="Users" subtitle="…" actions={[invite, exportCsv]} breadcrumbs={[{ label: "Admin", href: "/admin" }]}
 *        back="/users" tabs={[…]} tabsQuery="tab">…</Page>`
 * `back`: a path (Link) or `true` (history back). Actions render through ActionButton (hidden when not allowed).
 * A Page builds on Layout: under one it adds its `corners` content, `features` and `layout` region content to it (all
 * leave with the page) and writes its title to the document; on its own it brings the default Layout first.
 * `Page.extend({ narrow: true, tabsQuery: "tab" })` makes a page kind with its own defaults.
 */
export function Page(props: PageProps): Element {
  const layout = useLayout();
  // on its own: the same Page again, under a Layout (the props object is passed on as it is: getters stay live)
  if (!layout) return h(Layout, { children: () => Page(props) });
  for (const c of CORNERS) if (props.corners?.[c] != null) addControls(layout, c, props.corners[c], 20);
  for (const f of resolveFeatures(undefined, props.features)) layout.use(f);
  for (const [slot, content] of Object.entries(props.layout ?? {})) if (content !== undefined) layout.set(slot as SlotName, content);
  if (props.documentTitle !== false && globalThis.document) {
    const before = globalThis.document.title;
    effect(() => { const title = val(props.title); if (typeof title === "string" && title) globalThis.document.title = layout.titleTemplate.replace("%s", title); });
    onCleanup(() => { globalThis.document.title = before; });
  }
  const crumbs = (): readonly Breadcrumb[] => val(props.breadcrumbs) ?? [];
  return h("div", { ...rest(props, ["title", "subtitle", "actions", "breadcrumbs", "back", "tabs", "tabsQuery", "narrow", "corners", "features", "layout", "documentTitle"]), class: () => cx("hm-page", props.narrow && "hm-page-narrow", val(props.class)) },
    h("header", { class: "hm-page-head" },
      () => crumbs().length > 0 && h("nav", { class: "hm-crumbs", "aria-label": t`Breadcrumb` },
        h("ol", {}, crumbs().map((c, i, a) => h("li", {}, c.href && i < a.length - 1 ? h(Link, { href: c.href, children: () => val(c.label) }) : h("span", { "aria-current": i === a.length - 1 ? "page" : null }, () => val(c.label)))))),
      h("div", { class: "hm-page-titlebar" },
        props.back != null && (typeof props.back === "string"
          ? h(Link, { href: props.back, class: "hm-icon-btn hm-page-back", "aria-label": t`Back`, children: glyph(arrowLeft) })
          : h("button", { type: "button", class: "hm-icon-btn hm-page-back", "aria-label": () => t`Back`, onClick: () => (typeof props.back === "function" ? props.back() : historyBack()) }, glyph(arrowLeft))),
        h("div", { class: "hm-page-titles" },
          h("h1", { class: "hm-page-title" }, () => val(props.title)),
          props.subtitle != null && h("p", { class: "hm-page-sub" }, () => val(props.subtitle))),
        props.actions != null && h("div", { class: "hm-page-actions" }, actionsOf(() => props.actions)))),
    h("div", { class: "hm-page-body" },
      props.children,
      props.tabs != null && h(Tabs, { tabs: () => val(props.tabs), query: props.tabsQuery, label: () => val(props.title) as string })));
}

/** Props over defaults, keeping the props' getters live (a compiled reactive prop is a getter). */
function over<T extends object>(defaults: Partial<T>, props: T): T {
  const out = { ...defaults } as T;
  for (const k of Object.keys(props)) Object.defineProperty(out, k, Object.getOwnPropertyDescriptor(props, k)!);
  return out;
}
export interface PageComponent { (props: PageProps): Element; extend(defaults: Partial<PageProps>): PageComponent }
/** A page kind with its own defaults: `const SettingsPage = Page.extend({ narrow: true, tabsQuery: "tab" })`. */
Page.extend = function extend(defaults: Partial<PageProps>): PageComponent {
  const P = ((props: PageProps) => Page(over(defaults, props))) as PageComponent;
  P.extend = (more) => Page.extend({ ...defaults, ...more });
  return P;
};

export interface SectionProps { title?: MaybeFn<unknown>; description?: MaybeFn<unknown>; actions?: ActionsProp; class?: ClassProp; children?: unknown }
/** Titled block inside a page: `<Section title="Security" description="…" actions={[…]}>…</Section>` */
export function Section(props: SectionProps): Element {
  return h("section", { class: () => cx("hm-section", val(props.class)) },
    (props.title != null || props.actions != null) && h("div", { class: "hm-section-head" },
      h("div", {},
        props.title != null && h("h2", { class: "hm-section-title" }, () => val(props.title)),
        props.description != null && h("p", { class: "hm-section-desc" }, () => val(props.description))),
      props.actions != null && h("div", { class: "hm-section-actions" }, actionsOf(() => props.actions))),
    props.children);
}

export interface ListDetailProps {
  list: unknown;
  /** The detail pane (a zero-arg function is called when shown). */
  detail: unknown;
  /** Truthy when an item is selected (narrow screens then show the detail). */
  selected: MaybeFn<unknown>;
  onBack?: () => void;
  empty?: unknown;
  listLabel?: MaybeFn<string>;
  detailLabel?: MaybeFn<string>;
  class?: ClassProp;
}
/**
 * Master list + detail. On narrow screens only one pane shows: the list, or the detail (with a back button) when
 * `selected` is truthy. `<ListDetail list={<UserList/>} detail={() => <UserDetail id={$id}/>} selected={() => $id} onBack={() => $id = null} />`
 */
export function ListDetail(props: ListDetailProps): Element {
  const has = (): boolean => !!val(props.selected);
  return h("div", { class: () => cx("hm-ld", has() && "hm-ld-has-detail", val(props.class)) },
    h("div", { class: "hm-ld-list", "aria-label": () => val(props.listLabel) ?? null }, props.list),
    h("div", { class: "hm-ld-detail", role: "region", "aria-label": () => val(props.detailLabel) ?? t`Details` },
      () => (has()
        ? [props.onBack && h("button", { type: "button", class: "hm-btn hm-btn-ghost hm-btn-sm hm-ld-back", onClick: () => props.onBack?.() }, glyph(arrowLeft), () => t`Back`),
          untrack(() => (typeof props.detail === "function" && !props.detail.length ? (props.detail as () => unknown)() : props.detail))]
        : props.empty ?? h("p", { class: "hm-empty" }, () => t`Select an item to see its details.`))));
}

export interface PagerProps {
  /** Offset mode: 1-based page. */
  page?: MaybeFn<number | null | undefined>;
  total?: MaybeFn<number | null | undefined>;
  size?: MaybeFn<number | null | undefined>;
  onPage?: (page: number) => void;
  /** Set by `bind:page`. */
  setPage?: (page: number) => void;
  sizes?: readonly number[];
  onSize?: (size: number) => void;
  /** Cursor mode. */
  hasPrev?: MaybeFn<boolean>;
  hasNext?: MaybeFn<boolean>;
  onPrev?: () => void;
  onNext?: () => void;
  class?: ClassProp;
}
/**
 * Pagination. Offset mode: `<Pager page={$page} total={n} size={20} onPage={(p) => $page = p} sizes={[20, 50]} onSize={…} />`
 * (page is 1-based). Cursor mode: `<Pager hasPrev={…} hasNext={…} onPrev={…} onNext={…} />`.
 */
export function Pager(props: PagerProps): Element {
  const cursor = props.total === undefined && (props.onNext || props.hasNext !== undefined);
  const page = (): number => Number(val(props.page) ?? 1), size = (): number => Number(val(props.size) ?? 20), total = (): number => Number(val(props.total) ?? 0);
  const pages = (): number => Math.max(1, Math.ceil(total() / size()));
  const go = (p: number): void => { props.onPage?.(p); props.setPage?.(p); };
  const prevOk = (): boolean => (cursor ? !!val(props.hasPrev) : page() > 1), nextOk = (): boolean => (cursor ? !!val(props.hasNext) : page() < pages());
  const nf = (n: number): string => n.toLocaleString();
  return h("nav", { class: () => cx("hm-pager", val(props.class)), "aria-label": () => t`Pagination` },
    !cursor && h("span", { class: "hm-pager-info", "aria-live": "polite" }, () => {
      const n = total();
      if (!n) return t`No results`;
      const from = (page() - 1) * size() + 1, to = Math.min(n, page() * size());
      return t`${nf(from)}–${nf(to)} of ${nf(n)}`;
    }),
    props.sizes && !cursor && h("select", { class: "hm-select hm-select-sm", "aria-label": () => t`Rows per page`, onChange: (e: Event) => props.onSize?.(Number((e.target as HTMLSelectElement).value)) },
      props.sizes.map((s) => h("option", { value: String(s), selected: () => size() === s }, String(s)))),
    h("div", { class: "hm-pager-btns" },
      h("button", { type: "button", class: "hm-btn hm-btn-secondary hm-btn-sm", "data-prev": "", disabled: () => !prevOk(), onClick: () => (cursor ? props.onPrev?.() : go(page() - 1)) }, glyph(chevronLeft), () => t`Previous`),
      !cursor && h("span", { class: "hm-pager-page" }, () => t`Page ${page()} of ${pages()}`),
      h("button", { type: "button", class: "hm-btn hm-btn-secondary hm-btn-sm", "data-next": "", disabled: () => !nextOk(), onClick: () => (cursor ? props.onNext?.() : go(page() + 1)) }, () => t`Next`, glyph(chevronRight))));
}

export interface SearchBoxProps {
  /** A signal (two-way), or a value / accessor to follow. `bind:value` works too. */
  value?: Signal<string> | MaybeFn<string | null | undefined>;
  setValue?: (v: string) => void;
  onSearch?: (q: string) => void;
  onEnter?: (q: string) => void;
  /** ms (default 250). */
  debounce?: number;
  /** `true`: "/" focuses the box; or another combo. */
  shortcut?: boolean | string;
  placeholder?: MaybeFn<string | undefined>;
  label?: MaybeFn<string | undefined>;
  class?: ClassProp;
}
const isSignal = (v: unknown): v is Signal<string> => typeof v === "function" && (v as Partial<Signal<string>>).signal === true;
/**
 * Debounced search input with a clear button. `<SearchBox bind:value={$q} onSearch={(q) => …} debounce={250} shortcut />`
 * `shortcut`: pressing "/" anywhere focuses it.
 */
export function SearchBox(props: SearchBoxProps): Element {
  let input: HTMLInputElement | undefined;
  const sig = isSignal(props.value) ? props.value : null;
  const plain = (): string | null | undefined => val(props.value as MaybeFn<string | null | undefined>);
  const current = signal(String((sig ? sig.peek() : untrack(plain)) ?? ""));
  const write = (v: string): void => { if (sig) sig.set(v); props.setValue?.(v); };
  const emit = debounce((v: string) => { write(v); props.onSearch?.(v); }, props.debounce ?? 250);
  onCleanup(emit.cancel);
  // follow outside changes of a controlled value
  if (props.value !== undefined) effect(() => { const v = String((sig ? sig() : plain()) ?? ""); if (v !== untrack(current)) { current.set(v); if (input && input.value !== v) input.value = v; } });
  if (props.shortcut) key(props.shortcut === true ? "/" : props.shortcut, () => input?.focus(), { description: () => t`Focus search` });
  const filled = computed(() => current() !== "");
  const clear = (): void => { current.set(""); if (input) input.value = ""; emit.cancel(); write(""); props.onSearch?.(""); input?.focus(); };
  return h("div", { class: () => cx("hm-search", val(props.class)), role: "search" },
    h("span", { class: "hm-search-icon", "aria-hidden": "true" }, glyph(searchIcon)),
    h("input", {
      type: "search", class: "hm-input hm-search-input", ref: (x: HTMLInputElement) => { input = x; }, value: current.peek(),
      placeholder: () => val(props.placeholder) ?? t`Search…`, "aria-label": () => val(props.label) ?? val(props.placeholder) ?? t`Search`,
      autocomplete: "off", spellcheck: "false",
      onInput: (e: Event) => { const v = (e.target as HTMLInputElement).value; current.set(v); emit(v); },
      onKeydown: (e: KeyboardEvent) => {
        if (e.key === "Escape" && current.peek()) { e.preventDefault(); e.stopPropagation(); clear(); }
        else if (e.key === "Enter") { emit.cancel(); write(current.peek()); props.onSearch?.(current.peek()); props.onEnter?.(current.peek()); }
      },
    }),
    () => filled() && h("button", { type: "button", class: "hm-icon-btn hm-search-clear", "aria-label": () => t`Clear search`, onClick: clear }, glyph(xIcon)),
    props.shortcut && h("kbd", { class: "hm-kbd hm-search-kbd", "aria-hidden": "true" }, props.shortcut === true ? "/" : props.shortcut));
}

export { AppShell, type AppShellProps } from "./app-shell.ts";
