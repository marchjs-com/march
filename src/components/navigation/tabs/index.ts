// Tabs: `<Tabs tabs={[{ id, label, badge, content: () => node }]} query="tab" />` or `<Tabs><Tab id label>…</Tab></Tabs>`.
// TabList is the strip alone (tablist + roving focus + selection); Tabs adds the panel.
// Roving focus with ← → Home End (automatic activation). With `query="tab"` the active tab is kept in the URL (?tab=id).
import "./tabs.css";
import { signal, computed, effect, untrack, reactive } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { query as routeQuery, setQuery } from "../../../router/router.ts";
import { Badge } from "../../../ui/badge.ts";
import { roving } from "../../../ui/focus.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, uid, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { StatusDot } from "../../feedback/status-dot/index.ts";
import { motionPreset } from "../../../motion/engine/parts.ts";
import { x as xIcon } from "../../../icons/glyphs/x.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { animate } from "../../../motion/animate.ts";
import { reducedMotion } from "../../../motion/env.ts";
import { isRtl } from "../../../core/util.ts";

/** A tab: `content` is a node or a function rendering the panel (called when the tab becomes active). */
export interface TabSpec {
  id: string;
  label: MaybeFn<unknown>;
  badge?: MaybeFn<number | null | undefined>;
  disabled?: MaybeFn<boolean | undefined>;
  hidden?: MaybeFn<boolean | undefined>;
  /** An icon before the label (an icon definition, a short text or a node). */
  icon?: unknown;
  /** Tooltip of the tab (e.g. why it is disabled). */
  title?: MaybeFn<string | null | undefined>;
  /** A close mark on the tab; the Delete key closes too. Both call `onClose(id)`. */
  closable?: MaybeFn<boolean | undefined>;
  /** The "changed" dot (unsaved work). */
  dirty?: MaybeFn<boolean | undefined>;
  content?: unknown;
}
/** What <Tab> returns (a descriptor read by <Tabs>). */
export interface TabDescriptor extends TabSpec { readonly __tab: true; content: () => unknown }
export interface TabProps extends Omit<TabSpec, "content"> { children?: unknown }

/** Tab descriptor for `<Tabs>` children. */
export function Tab(props: TabProps): TabDescriptor {
  const d = { __tab: true } as TabDescriptor;
  for (const k of ["id", "label", "badge", "disabled", "hidden", "icon", "title", "closable", "dirty"] as const) Object.defineProperty(d, k, { get: () => props[k], enumerable: true });
  d.content = () => props.children;
  return d;
}

/** What the tab strip and `<Tabs>` share. */
export interface TabListLook {
  /** Theme color token (see ColorToken): "brand-blue", "success", "cat-3"… Default: the theme's primary. */
  color?: ColorToken | undefined;
  /** Accessible name of the tab list. */
  label?: MaybeFn<string | undefined>;
  /** "line" (default): underlined tabs; "pill": a rounded switch; "none" (TabList): no look, your own classes through `tabProps`. */
  variant?: MaybeFn<"line" | "pill" | "none" | undefined>;
  /** "auto" (default): the arrow keys select; "manual": they only move focus (Enter / Space select). */
  activation?: "auto" | "manual" | undefined;
  /** Called by the close mark of a `closable` tab and by the Delete key. */
  onClose?: ((id: string) => void) | undefined;
  /** Your own close mark (an icon or a short text). */
  closeIcon?: unknown;
  /** Texts: tooltip of the close mark, accessible name of the "changed" dot. */
  labels?: { close?: MaybeFn<string | undefined>; dirty?: MaybeFn<string | undefined> } | undefined;
  /** Extra attributes and events of a tab's button (`onPointerdown` for dragging, `onContextmenu`, `class`, `aria-*` …). */
  tabProps?: ((tab: TabSpec) => Record<string, unknown>) | undefined;
}

export interface TabListProps extends TabListLook {
  tabs: MaybeFn<readonly TabSpec[] | null | undefined>;
  /** The active tab id (a value or an accessor). */
  value: MaybeFn<string | null | undefined>;
  onSelect: (id: string) => void;
  orientation?: MaybeFn<"horizontal" | "vertical" | undefined>;
  /** DOM id of a tab's button (default: generated). */
  tabId?: ((id: string) => string) | undefined;
  /** id of the panel the tabs control (`aria-controls`). */
  controls?: string | undefined;
  /** Wrap a tab's button (e.g. in a Tooltip). */
  wrap?: ((button: Element, tab: TabSpec) => unknown) | undefined;
  /** Extra content inside the strip, before the tabs (a sliding indicator). */
  children?: unknown;
  class?: ClassProp;
}

/**
 * The tab strip alone: `role="tablist"`, roving focus, selection, icons, badges, the "changed" dot and close marks.
 * `<Tabs>` is this plus the panel; use it directly for a strip that drives something else.
 */
export function TabList(props: TabListProps): Element {
  const base = uid("hm-tab");
  const idOf = props.tabId ?? ((id: string) => `${base}-${id}`);
  const list = computed(() => (val(props.tabs) ?? []).filter((x) => x && !val(x.hidden)));
  const vertical = (): boolean => val(props.orientation) === "vertical";
  const look = (): boolean => val(props.variant) !== "none";
  let bar: HTMLElement | undefined;
  type TabButton = HTMLButtonElement;
  const tabEls = (): TabButton[] => (bar ? Array.from(bar.querySelectorAll<TabButton>('[role="tab"]')).filter((x) => !x.disabled) : []);
  const closes = (x: TabSpec | undefined): boolean => !!x && !!val(x.closable) && !val(x.disabled);
  return h("div", { "data-hm-color": () => colorAttr(props.color),
    class: () => cx(look() && "hm-tabs-bar", val(props.variant) === "pill" && "hm-tabs-bar-pill", val(props.class)), role: "tablist",
    "aria-orientation": () => (vertical() ? "vertical" : props.orientation !== undefined ? "horizontal" : null), "aria-label": () => val(props.label) ?? null, ref: (x: HTMLElement) => { bar = x; },
    onKeydown: (e: KeyboardEvent) => {
      const id = (e.target as HTMLElement).dataset?.["tab"];
      if (e.key === "Delete" && id != null && closes(untrack(list).find((x) => x.id === id))) { e.preventDefault(); props.onClose?.(id); return; }
      const el = roving(e, tabEls(), { horizontal: !vertical() });
      if (el && props.activation !== "manual") props.onSelect(el.dataset["tab"]!);
    },
  }, props.children, () => list().map((x) => untrack(() => {
    const on = (): boolean => val(props.value) === x.id;
    // no active tab: the first enabled one is the Tab stop
    const stop = (): boolean => on() || (!list().some((y) => y.id === val(props.value)) && list().find((y) => !val(y.disabled)) === x);
    const { class: own, ...attrs } = props.tabProps?.(x) ?? {};
    const btn = h("button", {
      ...attrs, type: "button", role: "tab", id: idOf(x.id), "data-tab": x.id, "aria-controls": props.controls ?? null,
      "aria-selected": () => String(on()), tabindex: () => (stop() ? "0" : "-1"), disabled: () => !!val(x.disabled), title: () => val(x.title) ?? null,
      "aria-keyshortcuts": () => (closes(x) ? "Delete" : (attrs["aria-keyshortcuts"] as string | null | undefined) ?? null),
      class: () => cx(look() && "hm-tab", on() && "is-active", val(own as ClassProp)), onClick: () => props.onSelect(x.id),
    }, icon(x.icon, "hm-tab-icon"), () => val(x.label), x.badge !== undefined && h(Badge, { count: () => val(x.badge), tone: "neutral" }),
    x.dirty !== undefined && (() => (val(x.dirty) ? h(StatusDot, { class: "hm-tab-dirty", tone: "primary", size: "sm", label: () => val(props.labels?.dirty) ?? t`unsaved changes` }) : null)),
    x.closable !== undefined && (() => (closes(x) ? h("span", {
      class: "hm-tab-close", "aria-hidden": "true", title: () => val(props.labels?.close) ?? t`Close`,
      onPointerdown: (e: Event) => e.stopPropagation(), onClick: (e: Event) => { e.stopPropagation(); props.onClose?.(x.id); },
    }, ownIcon(props.closeIcon ?? undefined, xIcon, "hm-tab-close-own")) : null)));
    return props.wrap ? props.wrap(btn, x) : btn;
  })));
}

export interface TabsProps extends TabListLook {
  tabs?: MaybeFn<readonly TabSpec[] | null | undefined>;
  /** Controlled active id (`bind:value` works). */
  value?: MaybeFn<string | null | undefined>;
  onChange?: (id: string) => void;
  setValue?: (id: string) => void;
  /** Keep the active tab in this query parameter. */
  query?: string | undefined;
  class?: ClassProp;
  /** <Tab> children (when `tabs` is not given). */
  children?: unknown;
  /** false: render only the tab bar. */
  panel?: boolean;
  /** Content at the end of the tab bar (buttons, a menu): outside the tab list, stays put while the tabs scroll. */
  actions?: unknown;
  /** The underline of the active tab (default true). */
  indicator?: boolean | undefined;
  /**
   * Panel motion. Default: the panel rises in once, when it first appears. "none": no motion. "fade", "rise", "slide"
   * (from the side of the new tab, mirrored in RTL) play on every switch; or your own `(panel, dir) => void`
   * (dir 1: a later tab, -1: an earlier one).
   */
  motion?: "none" | "fade" | "rise" | "slide" | ((panel: HTMLElement, dir: 1 | -1) => void) | undefined;
}

// a live prop for h(Component, …): it becomes a getter
const live = reactive as <T>(fn: () => T) => T;

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
  const nav = h(TabList, {
    tabs: list, value: current, onSelect: select, controls: `${base}-p`, tabId: (id: string) => `${base}-t-${id}`,
    color: live(() => props.color), label: () => val(props.label), variant: () => val(props.variant), labels: live(() => props.labels),
    activation: props.activation, onClose: (id: string) => props.onClose?.(id), closeIcon: props.closeIcon, tabProps: props.tabProps,
  });
  // Only the active panel exists; switching disposes the old one.
  const panel = h("div", { class: "hm-tabs-panel", role: "tabpanel", id: `${base}-p`, tabindex: "0", "aria-labelledby": () => `${base}-t-${current()}` },
    () => {
      const id = current();
      const tab = untrack(list).find((x) => x.id === id);
      return tab ? untrack(() => (typeof tab.content === "function" ? (tab.content as () => unknown)() : tab.content)) : null;
    });
  // motion on every switch (opt-in): the motion engine plays it on the panel; reduced motion switches at once
  const motion = props.motion;
  if (motion && motion !== "none" && props.panel !== false) {
    let last: string | null | undefined;
    effect(() => {
      const id = current();
      untrack(() => {
        const ids = list().map((x) => x.id), prev = last;
        last = id;
        if (prev == null || id == null || prev === id || reducedMotion()) return;
        const dir = ids.indexOf(id) > ids.indexOf(prev) ? 1 : -1;
        if (typeof motion === "function") motion(panel as HTMLElement, dir);
        else animate(panel as HTMLElement, motion === "slide" ? motionPreset("slide", { x: dir * (isRtl(panel as HTMLElement) ? -1 : 1) * 24, y: 0 }) : motionPreset(motion), { duration: 240, easing: "out" });
      });
    });
  }
  return h("div", { class: () => cx("hm-tabs", props.indicator === false && "hm-tabs-plain", motion && "hm-tabs-still", val(props.class)) },
    props.actions == null || props.actions === false ? nav : h("div", { class: "hm-tabs-head" }, nav, h("div", { class: "hm-tabs-actions" }, props.actions)), props.panel === false ? null : panel);
}
