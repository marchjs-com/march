// Page scaffolding: Page, Section, ListDetail, Pager, SearchBox.
import { signal, computed, untrack, effect, onCleanup } from "../core/reactive.js";
import { h } from "../dom/h.js";
import { t } from "../core/i18n.js";
import { Link, back as historyBack } from "../router/index.js";
import { actionsOf } from "./display.js";
import { Tabs } from "./tabs.js";
import { key } from "./keys.js";
import { val, cx, rest, debounce } from "./util.js";

/**
 * `<Page title="Users" subtitle="…" actions={[invite, exportCsv]} breadcrumbs={[{ label: "Admin", href: "/admin" }]}
 *        back="/users" tabs={[…]} tabsQuery="tab">…</Page>`
 * `back`: a path (Link) or `true` (history back). Actions render through ActionButton (hidden when not allowed).
 */
export function Page(props) {
  const crumbs = () => val(props.breadcrumbs) ?? [];
  return h("div", { ...rest(props, ["title", "subtitle", "actions", "breadcrumbs", "back", "tabs", "tabsQuery", "narrow"]), class: () => cx("hm-page", props.narrow && "hm-page-narrow", val(props.class)) },
    h("header", { class: "hm-page-head" },
      () => crumbs().length > 0 && h("nav", { class: "hm-crumbs", "aria-label": t`Breadcrumb` },
        h("ol", {}, crumbs().map((c, i, a) => h("li", {}, c.href && i < a.length - 1 ? h(Link, { href: c.href, children: () => val(c.label) }) : h("span", { "aria-current": i === a.length - 1 ? "page" : null }, () => val(c.label)))))),
      h("div", { class: "hm-page-titlebar" },
        props.back != null && (typeof props.back === "string"
          ? h(Link, { href: props.back, class: "hm-icon-btn hm-page-back", "aria-label": t`Back`, children: "←" })
          : h("button", { type: "button", class: "hm-icon-btn hm-page-back", "aria-label": () => t`Back`, onClick: () => (typeof props.back === "function" ? props.back() : historyBack()) }, "←")),
        h("div", { class: "hm-page-titles" },
          h("h1", { class: "hm-page-title" }, () => val(props.title)),
          props.subtitle != null && h("p", { class: "hm-page-sub" }, () => val(props.subtitle))),
        props.actions != null && h("div", { class: "hm-page-actions" }, actionsOf(() => props.actions)))),
    h("div", { class: "hm-page-body" },
      props.children,
      props.tabs != null && h(Tabs, { tabs: () => val(props.tabs), query: props.tabsQuery, label: () => val(props.title) })));
}

/** Titled block inside a page: `<Section title="Security" description="…" actions={[…]}>…</Section>` */
export function Section(props) {
  return h("section", { class: () => cx("hm-section", val(props.class)) },
    (props.title != null || props.actions != null) && h("div", { class: "hm-section-head" },
      h("div", {},
        props.title != null && h("h2", { class: "hm-section-title" }, () => val(props.title)),
        props.description != null && h("p", { class: "hm-section-desc" }, () => val(props.description))),
      props.actions != null && h("div", { class: "hm-section-actions" }, actionsOf(() => props.actions))),
    props.children);
}

/**
 * Master list + detail. On narrow screens only one pane shows: the list, or the detail (with a back button) when
 * `selected` is truthy. `<ListDetail list={<UserList/>} detail={() => <UserDetail id={$id}/>} selected={() => $id} onBack={() => $id = null} />`
 */
export function ListDetail(props) {
  const has = () => !!val(props.selected);
  return h("div", { class: () => cx("hm-ld", has() && "hm-ld-has-detail", val(props.class)) },
    h("div", { class: "hm-ld-list", "aria-label": () => val(props.listLabel) ?? null }, props.list),
    h("div", { class: "hm-ld-detail", role: "region", "aria-label": () => val(props.detailLabel) ?? t`Details` },
      () => (has()
        ? [props.onBack && h("button", { type: "button", class: "hm-btn hm-btn-ghost hm-btn-sm hm-ld-back", onClick: () => props.onBack() }, () => `← ${t`Back`}`),
          untrack(() => (typeof props.detail === "function" && !props.detail.length ? props.detail() : props.detail))]
        : props.empty ?? h("p", { class: "hm-empty" }, () => t`Select an item to see its details.`))));
}

/**
 * Pagination. Offset mode: `<Pager page={$page} total={n} size={20} onPage={(p) => $page = p} sizes={[20, 50]} onSize={…} />`
 * (page is 1-based). Cursor mode: `<Pager hasPrev={…} hasNext={…} onPrev={…} onNext={…} />`.
 */
export function Pager(props) {
  const cursor = props.total === undefined && (props.onNext || props.hasNext !== undefined);
  const page = () => Number(val(props.page) ?? 1), size = () => Number(val(props.size) ?? 20), total = () => Number(val(props.total) ?? 0);
  const pages = () => Math.max(1, Math.ceil(total() / size()));
  const go = (p) => { props.onPage?.(p); props.setPage?.(p); };
  const prevOk = () => (cursor ? !!val(props.hasPrev) : page() > 1), nextOk = () => (cursor ? !!val(props.hasNext) : page() < pages());
  const nf = (n) => n.toLocaleString();
  return h("nav", { class: () => cx("hm-pager", val(props.class)), "aria-label": () => t`Pagination` },
    !cursor && h("span", { class: "hm-pager-info", "aria-live": "polite" }, () => {
      const n = total();
      if (!n) return t`No results`;
      const from = (page() - 1) * size() + 1, to = Math.min(n, page() * size());
      return t`${nf(from)}–${nf(to)} of ${nf(n)}`;
    }),
    props.sizes && !cursor && h("select", { class: "hm-select hm-select-sm", "aria-label": () => t`Rows per page`, onChange: (e) => props.onSize?.(Number(e.target.value)) },
      props.sizes.map((s) => h("option", { value: String(s), selected: () => size() === s }, String(s)))),
    h("div", { class: "hm-pager-btns" },
      h("button", { type: "button", class: "hm-btn hm-btn-secondary hm-btn-sm", "data-prev": "", disabled: () => !prevOk(), onClick: () => (cursor ? props.onPrev?.() : go(page() - 1)) }, () => `‹ ${t`Previous`}`),
      !cursor && h("span", { class: "hm-pager-page" }, () => t`Page ${page()} of ${pages()}`),
      h("button", { type: "button", class: "hm-btn hm-btn-secondary hm-btn-sm", "data-next": "", disabled: () => !nextOk(), onClick: () => (cursor ? props.onNext?.() : go(page() + 1)) }, () => `${t`Next`} ›`)));
}

/**
 * Debounced search input with a clear button. `<SearchBox bind:value={$q} onSearch={(q) => …} debounce={250} shortcut />`
 * `shortcut`: pressing "/" anywhere focuses it.
 */
export function SearchBox(props) {
  let input;
  const isSig = props.value?.signal;
  const current = signal(String((isSig ? props.value.peek() : untrack(() => val(props.value))) ?? ""));
  const write = (v) => { if (isSig) props.value.set(v); props.setValue?.(v); };
  const emit = debounce((v) => { write(v); props.onSearch?.(v); }, props.debounce ?? 250);
  onCleanup(emit.cancel);
  // follow outside changes of a controlled value
  if (props.value !== undefined) effect(() => { const v = String((isSig ? props.value() : val(props.value)) ?? ""); if (v !== untrack(current)) { current.set(v); if (input && input.value !== v) input.value = v; } });
  if (props.shortcut) key(props.shortcut === true ? "/" : props.shortcut, () => input?.focus(), { description: () => t`Focus search` });
  const filled = computed(() => current() !== "");
  const clear = () => { current.set(""); input.value = ""; emit.cancel(); write(""); props.onSearch?.(""); input.focus(); };
  return h("div", { class: () => cx("hm-search", val(props.class)), role: "search" },
    h("span", { class: "hm-search-icon", "aria-hidden": "true" }, "⌕"),
    h("input", {
      type: "search", class: "hm-input hm-search-input", ref: (x) => { input = x; }, value: current.peek(),
      placeholder: () => val(props.placeholder) ?? t`Search…`, "aria-label": () => val(props.label) ?? val(props.placeholder) ?? t`Search`,
      autocomplete: "off", spellcheck: "false",
      onInput: (e) => { current.set(e.target.value); emit(e.target.value); },
      onKeydown: (e) => {
        if (e.key === "Escape" && current.peek()) { e.preventDefault(); e.stopPropagation(); clear(); }
        else if (e.key === "Enter") { emit.cancel(); write(current.peek()); props.onSearch?.(current.peek()); props.onEnter?.(current.peek()); }
      },
    }),
    () => filled() && h("button", { type: "button", class: "hm-icon-btn hm-search-clear", "aria-label": () => t`Clear search`, onClick: clear }, "×"),
    props.shortcut && h("kbd", { class: "hm-kbd hm-search-kbd", "aria-hidden": "true" }, props.shortcut === true ? "/" : props.shortcut));
}
