// Tabs: `<Tabs tabs={[{ id, label, badge, content: () => node }]} query="tab" />` or `<Tabs><Tab id label>…</Tab></Tabs>`.
// Roving focus with ← → Home End (automatic activation). With `query="tab"` the active tab is kept in the URL (?tab=id).
import { signal, computed, untrack } from "../core/reactive.js";
import { h } from "../dom/h.js";
import { query as routeQuery, setQuery } from "../router/index.ts";
import { Badge } from "./display.js";
import { roving } from "./focus.js";
import { val, cx, uid } from "./util.js";

/** Tab descriptor for `<Tabs>` children. */
export function Tab(props) {
  const d = { __tab: true };
  for (const k of ["id", "label", "badge", "disabled", "hidden"]) Object.defineProperty(d, k, { get: () => props[k], enumerable: true });
  d.content = () => props.children;
  return d;
}

/**
 * @param {{ tabs?: any, value?: any, onChange?: (id: string) => void, query?: string, label?: string, class?: string, children?: any, lazy?: boolean }} props
 * `value` + `onChange` make it controlled (`bind:value` works).
 */
export function Tabs(props) {
  const base = uid("hm-tabs");
  const list = computed(() => {
    const src = props.tabs !== undefined ? val(props.tabs) : [].concat(props.children ?? []).flat();
    return (src ?? []).filter((x) => x && (x.__tab || x.id != null) && !val(x.hidden));
  });
  const local = signal(null);
  const current = computed(() => {
    const tabs = list();
    const want = (props.query && routeQuery()[props.query]) ?? val(props.value) ?? local();
    return tabs.find((x) => x.id === want && !val(x.disabled))?.id ?? tabs.find((x) => !val(x.disabled))?.id ?? null;
  });
  const select = (id) => {
    if (id === untrack(current)) return;
    local.set(id);
    props.onChange?.(id);
    props.setValue?.(id);
    if (props.query) { try { setQuery({ [props.query]: id }); } catch { /* no router: local state only */ } }
  };
  let bar;
  const tabEls = () => bar.querySelectorAll('[role="tab"]').filter((x) => !x.disabled);
  const nav = h("div", {
    class: "hm-tabs-bar", role: "tablist", "aria-label": () => val(props.label) ?? null, ref: (x) => { bar = x; },
    onKeydown: (e) => { const el = roving(e, tabEls(), { horizontal: true }); if (el) select(el.dataset.tab); },
  }, () => list().map((x) => untrack(() => {
    const on = () => current() === x.id;
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
      return tab ? untrack(() => (typeof tab.content === "function" ? tab.content() : tab.content)) : null;
    });
  return h("div", { class: () => cx("hm-tabs", val(props.class)) }, nav, props.panel === false ? null : panel);
}
