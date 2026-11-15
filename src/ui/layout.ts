// Page scaffolding: Page, Section, ListDetail, Pager (SearchBox is re-exported from its component folder).
import "./layout.css";
import "./field.css";
import { untrack, effect, onCleanup } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { lazy } from "../dom/lazy.ts";
import { t } from "../core/i18n.ts";
import { back as historyBack, type Href } from "../router/router.ts";
import { actionsOf } from "./display-base.ts";
import { type ActionsProp } from "./display.ts";
import { Tabs, type TabSpec } from "./tabs.ts";
import { val, cx, rest, type MaybeFn, type ClassProp } from "./util.ts";
import { Layout, useLayout, addControls, resolveFeatures, type LayoutProps, type SlotName } from "../components/layout/layout/index.ts";
import { CORNERS } from "../components/layout/bottom-right-controls/index.ts";
import { PanelHeader } from "../components/layout/panel-header/index.ts";
import { Button } from "../components/actions/button/index.ts";
import { IconButton } from "../components/actions/icon-button/index.ts";
import { Empty } from "../components/feedback/empty/index.ts";
import { Pagination, type PaginationProps } from "../components/navigation/pagination/index.ts";
import type { BreadcrumbsProps } from "../components/navigation/breadcrumbs/index.ts";
import { arrowLeft } from "../icons/glyphs/arrowLeft.ts";

// The trail of a page is the Breadcrumbs component (menus, overflow): it comes in its own chunk, only for pages with a trail.
const Crumbs = /* @__PURE__ */ lazy<BreadcrumbsProps>(() => import("../components/navigation/breadcrumbs/index.ts"), { pick: "Breadcrumbs", placeholder: "none", height: "1.875rem" });

/** A breadcrumb; the last one is the current page. */
export interface Breadcrumb { label: MaybeFn<string>; href?: Href }
export interface PageProps extends Pick<LayoutProps, "corners" | "features"> {
  /** The page heading (an h1); also written to the document title. @tr Sayfa başlığı (bir h1); belge başlığına da yazılır. */
  title: MaybeFn<unknown>;
  /** Region content of the surrounding Layout while this page is shown, e.g. `{ aside: <Filters/> }`. @tr Bu sayfa gösterilirken çevreleyen Layout'un bölge içeriği, ör. `{ aside: <Filters/> }`. */
  layout?: Partial<Pick<LayoutProps, "top" | "header" | "nav" | "aside" | "footer">> | undefined;
  /** Write the title to the document (through the Layout's titleTemplate). Default true. @tr Başlığı belgeye yazar (Layout'un titleTemplate'i ile). Varsayılan true. */
  documentTitle?: boolean | undefined;
  /** A short line under the title. @tr Başlığın altındaki kısa satır. */
  subtitle?: MaybeFn<unknown>;
  /** Buttons at the right of the title bar (hidden when not allowed). @tr Başlık çubuğunun sağındaki düğmeler (izin yoksa gizlenir). */
  actions?: ActionsProp;
  /** The trail above the title; the last one is the current page. @tr Başlığın üstündeki iz; sonuncusu geçerli sayfadır. */
  breadcrumbs?: MaybeFn<readonly Breadcrumb[] | null | undefined>;
  /** A path (Link), `true` (history back) or a function. @tr Bir yol (Link), `true` (geçmişte geri) ya da bir fonksiyon. */
  back?: Href | true | (() => unknown);
  /** Tabs under the content. @tr İçeriğin altındaki sekmeler. */
  tabs?: MaybeFn<readonly TabSpec[] | null | undefined>;
  /** Keep the active tab in this query parameter. @tr Etkin sekmeyi bu sorgu parametresinde tutar. */
  tabsQuery?: string;
  /** A narrower, centred content column (forms, settings). @tr Daha dar, ortalanmış içerik sütunu (formlar, ayarlar). */
  narrow?: boolean;
  /** Extra CSS classes on the root. @tr Köke eklenen ek CSS sınıfları. */
  class?: ClassProp;
  /** The page content. @tr Sayfa içeriği. */
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
  if (!layout) return h(Layout, { children: () => Page(props) }) as Element;
  for (const c of CORNERS) if (props.corners?.[c] != null) addControls(layout, c, props.corners[c], 20);
  for (const f of resolveFeatures(undefined, props.features)) layout.use(f);
  for (const [slot, content] of Object.entries(props.layout ?? {})) if (content !== undefined) layout.set(slot as SlotName, content);
  if (props.documentTitle !== false && globalThis.document) {
    const before = globalThis.document.title;
    effect(() => { const title = val(props.title); if (typeof title === "string" && title) globalThis.document.title = layout.titleTemplate.replace("%s", title); });
    onCleanup(() => { globalThis.document.title = before; });
  }
  const crumbs = (): readonly Breadcrumb[] => val(props.breadcrumbs) ?? [];
  return h("div", { ...rest(props, ["title", "subtitle", "actions", "breadcrumbs", "back", "tabs", "tabsQuery", "narrow", "corners", "features", "layout", "documentTitle"]), class: () => cx("m-page", props.narrow && "m-page-narrow", val(props.class)) },
    h("header", { class: "m-page-head" },
      () => crumbs().length > 0 && untrack(() => h(Crumbs, { class: "m-page-crumbs", separator: "/", label: () => t`Breadcrumb`, items: () => crumbs().map((c, i) => ({ id: String(i), label: c.label, ...(c.href ? { href: c.href } : {}) })) })),
      h(PanelHeader, {
        as: "div", class: "m-page-titlebar", size: "lg", titleAs: "h1", title: () => val(props.title), subtitle: props.subtitle != null ? () => val(props.subtitle) : undefined,
        partClass: { titles: "m-page-titles", title: "m-page-title", subtitle: "m-page-sub", actions: "m-page-actions" },
        lead: props.back != null ? h(IconButton, {
          class: "m-page-back", variant: "raised", icon: arrowLeft, label: () => t`Back`, title: false,
          ...(typeof props.back === "string" ? { href: props.back } : { onClick: () => (typeof props.back === "function" ? props.back() : historyBack()) }),
        }) : undefined,
        actions: props.actions != null ? actionsOf(() => props.actions) : undefined,
      })),
    h("div", { class: "m-page-body" },
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

export interface SectionProps {
  /** The section heading (an h2). @tr Bölüm başlığı (bir h2). */
  title?: MaybeFn<unknown>;
  /** A short line under the title. @tr Başlığın altındaki kısa satır. */
  description?: MaybeFn<unknown>;
  /** Buttons at the right of the heading (hidden when not allowed). @tr Başlığın sağındaki düğmeler (izin yoksa gizlenir). */
  actions?: ActionsProp;
  /** Extra CSS classes on the root. @tr Köke eklenen ek CSS sınıfları. */
  class?: ClassProp;
  /** The section content. @tr Bölüm içeriği. */
  children?: unknown;
}
/** Titled block inside a page: `<Section title="Security" description="…" actions={[…]}>…</Section>` */
export function Section(props: SectionProps): Element {
  return h("section", { class: () => cx("m-section", val(props.class)) },
    (props.title != null || props.actions != null) && h(PanelHeader, {
      as: "div", class: "m-section-head", titleAs: "h2", title: props.title != null ? () => val(props.title) : undefined,
      subtitle: props.description != null ? () => val(props.description) : undefined,
      partClass: { title: "m-section-title", subtitle: "m-section-desc", actions: "m-section-actions" },
      actions: props.actions != null ? actionsOf(() => props.actions) : undefined,
    }),
    props.children);
}

export interface ListDetailProps {
  /** The list pane. @tr Liste bölmesi. */
  list: unknown;
  /** The detail pane (a zero-arg function is called when shown). @tr Ayrıntı bölmesi (argümansız bir fonksiyon gösterilirken çağrılır). */
  detail: unknown;
  /** Truthy when an item is selected (narrow screens then show the detail). @tr Bir öğe seçiliyken doğru (truthy) olur (dar ekranlar o zaman ayrıntıyı gösterir). */
  selected: MaybeFn<unknown>;
  /** Called by the Back button of the detail pane; without it there is no Back button. @tr Ayrıntı bölmesindeki Geri düğmesi bunu çağırır; verilmezse Geri düğmesi olmaz. */
  onBack?: () => void;
  /** Shown in the detail pane when nothing is selected. @tr Hiçbir şey seçili değilken ayrıntı bölmesinde gösterilir. */
  empty?: unknown;
  /** aria-label of the list pane. @tr Liste bölmesinin aria-label'ı. */
  listLabel?: MaybeFn<string>;
  /** aria-label of the detail pane (default "Details"). @tr Ayrıntı bölmesinin aria-label'ı (varsayılan "Details"). */
  detailLabel?: MaybeFn<string>;
  /** Extra CSS classes on the root. @tr Köke eklenen ek CSS sınıfları. */
  class?: ClassProp;
}
/**
 * Master list + detail. On narrow screens only one pane shows: the list, or the detail (with a back button) when
 * `selected` is truthy. `<ListDetail list={<UserList/>} detail={() => <UserDetail id={$id}/>} selected={() => $id} onBack={() => $id = null} />`
 */
export function ListDetail(props: ListDetailProps): Element {
  const has = (): boolean => !!val(props.selected);
  return h("div", { class: () => cx("m-ld", has() && "m-ld-has-detail", val(props.class)) },
    h("div", { class: "m-ld-list", "aria-label": () => val(props.listLabel) ?? null }, props.list),
    h("div", { class: "m-ld-detail", role: "region", "aria-label": () => val(props.detailLabel) ?? t`Details` },
      () => (has()
        ? [props.onBack && h(Button, { variant: "ghost", size: "sm", class: "m-ld-back", icon: arrowLeft, onClick: () => props.onBack?.() }, () => t`Back`),
          untrack(() => (typeof props.detail === "function" && !props.detail.length ? (props.detail as () => unknown)() : props.detail))]
        : props.empty ?? h(Empty, { size: "sm", title: () => t`Select an item to see its details.` }))));
}

export interface PagerProps {
  /** Offset mode: 1-based page. @tr Sayfa numarası modu: 1'den başlayan sayfa. */
  page?: MaybeFn<number | null | undefined>;
  /** Total number of items (offset mode). @tr Toplam öğe sayısı (sayfa numarası modu). */
  total?: MaybeFn<number | null | undefined>;
  /** Items per page. @tr Sayfa başına öğe sayısı. */
  size?: MaybeFn<number | null | undefined>;
  /** Called with the new page (1-based). @tr Yeni sayfa numarasıyla (1'den başlar) çağrılır. */
  onPage?: (page: number) => void;
  /** Set by `bind:page`. @tr `bind:page` tarafından verilir. */
  setPage?: (page: number) => void;
  /** Page size choices; a size picker appears when given. @tr Sayfa boyutu seçenekleri; verilirse bir boyut seçici görünür. */
  sizes?: readonly number[];
  /** Called with the picked page size. @tr Seçilen sayfa boyutuyla çağrılır. */
  onSize?: (size: number) => void;
  /** Cursor mode. @tr İmleç modu. */
  hasPrev?: MaybeFn<boolean>;
  /** Cursor mode: whether a next page exists. @tr İmleç modu: sonraki sayfa var mı. */
  hasNext?: MaybeFn<boolean>;
  /** Cursor mode: called by the previous button. @tr İmleç modu: önceki düğmesi çağırır. */
  onPrev?: () => void;
  /** Cursor mode: called by the next button. @tr İmleç modu: sonraki düğmesi çağırır. */
  onNext?: () => void;
  /** Extra CSS classes on the root. @tr Köke eklenen ek CSS sınıfları. */
  class?: ClassProp;
}
/**
 * `<Pagination variant="simple">` under its older name. Offset mode: `<Pager page={$page} total={n} size={20} onPage={(p) => $page = p} sizes={[20, 50]} onSize={…} />`
 * (page is 1-based). Cursor mode: `<Pager hasPrev={…} hasNext={…} onPrev={…} onNext={…} />`.
 */
export function Pager(props: PagerProps): Element {
  // the props as they are (getters stay live), as the simple variant, with the old class on the root
  const own: PaginationProps = { variant: "simple" };
  for (const k of Object.keys(props)) if (k !== "class") Object.defineProperty(own, k, Object.getOwnPropertyDescriptor(props, k)!);
  Object.defineProperty(own, "class", { get: () => cx("m-pager", val(props.class)), enumerable: true });
  const el = Pagination(own);
  // the hooks apps knew: .m-pager, .m-pager-info, [data-prev], [data-next]
  el.querySelector(".m-page-info")?.classList.add("m-pager-info");
  const steps = el.querySelectorAll("button");
  steps[0]?.setAttribute("data-prev", "");
  steps[steps.length - 1]?.setAttribute("data-next", "");
  return el;
}

// SearchBox lives in its own component folder; this module keeps exporting it.
export { SearchBox, type SearchBoxProps } from "../components/forms/search-box/index.ts";

export { AppShell, type AppShellProps } from "./app-shell.ts";
