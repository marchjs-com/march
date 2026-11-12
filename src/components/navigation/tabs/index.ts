// Tabs: `<Tabs tabs={[{ id, label, badge, content: () => node }]} query="tab" />` or `<Tabs><Tab id label>…</Tab></Tabs>`.
// Roving focus with ← → Home End (automatic activation). With `query="tab"` the active tab is kept in the URL (?tab=id).
import "./tabs.css";
import { signal, computed, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { query as routeQuery, setQuery } from "../../../router/router.ts";
import { Badge } from "../../../ui/badge.ts";
import { roving } from "../../../ui/focus.ts";
import { val, cx, uid, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

/** A tab: `content` is a node or a function rendering the panel (called when the tab becomes active). */
export interface TabSpec {
  id: string;
  label: MaybeFn<unknown>;
  badge?: MaybeFn<number | null | undefined>;
  disabled?: MaybeFn<boolean | undefined>;
  hidden?: MaybeFn<boolean | undefined>;
  content?: unknown;
}
/** What <Tab> returns (a descriptor read by <Tabs>). */
export interface TabDescriptor extends TabSpec { readonly __tab: true; content: () => unknown }
export interface TabProps { id: string; label: MaybeFn<unknown>; badge?: MaybeFn<number | null | undefined>; disabled?: MaybeFn<boolean | undefined>; hidden?: MaybeFn<boolean | undefined>; children?: unknown }

/** Tab descriptor for `<Tabs>` children. */
export function Tab(props: TabProps): TabDescriptor {
  const d = { __tab: true } as TabDescriptor;
  for (const k of ["id", "label", "badge", "disabled", "hidden"] as const) Object.defineProperty(d, k, { get: () => props[k], enumerable: true });
  d.content = () => props.children;
  return d;
}

export interface TabsProps {
  /** Theme color token (see ColorToken): "brand-blue", "success", "cat-3"… Default: the theme's primary. */
  color?: ColorToken | undefined;
  tabs?: MaybeFn<readonly TabSpec[] | null | undefined>;
  /** Controlled active id (`bind:value` works). */
  value?: MaybeFn<string | null | undefined>;
  onChange?: (id: string) => void;
  setValue?: (id: string) => void;
  /** Keep the active tab in this query parameter. */
  query?: string | undefined;
  label?: MaybeFn<string | undefined>;
  class?: ClassProp;
  /** <Tab> children (when `tabs` is not given). */
  children?: unknown;
  /** false: render only the tab bar. */
  panel?: boolean;
}

/** `value` + `onChange` make it controlled (`bind:value` works). */
export function Tabs(props: TabsProps): Element {
  const base = uid("hm-tabs");
  const list = computed(() => {
    const src = props.tabs !== undefined ? val(props.tabs) : ([] as unknown[]).concat(props.children ?? []).flat() as TabSpec[];
    return (src ?? []).filter((x) => x && ((x as Partial<TabDescriptor>).__tab || x.id != null) && !val(x.hidden));
  });
  const local = signal<string | null>(null);
  const current = computed(() => {
    const tabs = list();
    const want = (props.query && routeQuery()[props.query]) ?? val(props.value) ?? local();
    return tabs.find((x) => x.id === want && !val(x.disabled))?.id ?? tabs.find((x) => !val(x.disabled))?.id ?? null;
  });
  const select = (id: string | undefined): void => {
    if (id == null || id === untrack(current)) return;
    local.set(id);
    props.onChange?.(id);
    props.setValue?.(id);
    if (props.query) { try { void setQuery({ [props.query]: id }); } catch { /* no router: local state only */ } }
  };
  let bar: HTMLElement | undefined;
  type TabButton = HTMLButtonElement;
  const tabEls = (): TabButton[] => (bar ? Array.from(bar.querySelectorAll<TabButton>('[role="tab"]')).filter((x) => !x.disabled) : []);
  const nav = h("div", { "data-hm-color": () => colorAttr(props.color),
    class: "hm-tabs-bar", role: "tablist", "aria-label": () => val(props.label) ?? null, ref: (x: HTMLElement) => { bar = x; },
    onKeydown: (e: KeyboardEvent) => { const el = roving(e, tabEls(), { horizontal: true }); if (el) select(el.dataset["tab"]); },
  }, () => list().map((x) => untrack(() => {
    const on = (): boolean => current() === x.id;
    return h("button", {
      type: "button", role: "tab", id: `${base}-t-${x.id}`, "data-tab": x.id, "aria-controls": `${base}-p`,
      "aria-selected": () => String(on()), tabindex: () => (on() ? "0" : "-1"), disabled: () => !!val(x.disabled),
      class: () => cx("hm-tab", on() && "is-active"), onClick: () => select(x.id),
    }, () => val(x.label), x.badge !== undefined && h(Badge, { count: () => val(x.badge), tone: "neutral" }));
  })));
  // Only the active panel exists; switching disposes the old one.
  const panel = h("div", { class: "hm-tabs-panel", role: "tabpanel", id: `${base}-p`, tabindex: "0", "aria-labelledby": () => `${base}-t-${current()}` },
    () => {
      const id = current();
      const tab = untrack(list).find((x) => x.id === id);
      return tab ? untrack(() => (typeof tab.content === "function" ? (tab.content as () => unknown)() : tab.content)) : null;
    });
  return h("div", { class: () => cx("hm-tabs", val(props.class)) }, nav, props.panel === false ? null : panel);
}
