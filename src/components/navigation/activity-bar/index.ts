// ActivityBar (hadi-march/ui): the narrow icon bar at the edge of an editor that switches the side view (Files,
// Search, Source control…). A tablist: ↑ ↓ (← → when horizontal, mirrored in RTL) move, Enter / Space choose,
// choosing the active view again collapses it (value null). An indicator glides to the active view (motion engine).
// Items can sit at the end of the bar (settings, account) and carry count badges.
import "./activity-bar.css";
import { computed, effect, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { val, cx, icon, uid, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { setStyle } from "../../../core/util.ts";
import { Badge } from "../../../ui/badge.ts";
import { Tooltip } from "../../../ui/menu.ts";
import { roving, isRtl } from "../../../ui/focus.ts";
import { formatKey } from "../../../ui/keys.ts";
import { animate } from "../../../motion/animate.ts";
import { reducedMotion } from "../../../motion/env.ts";

messages("tr", { "Views": "Görünümler" });

export interface ActivityItem {
  id: string;
  label: MaybeFn<string>;
  icon: unknown;
  badge?: MaybeFn<number | null | undefined>;
  /** "end": at the far end of the bar (settings, account). */
  position?: "start" | "end";
  shortcut?: string;
  /** A plain action instead of a view (it is not selected). */
  onSelect?: () => unknown;
}
export interface ActivityBarProps {
  items: MaybeFn<readonly ActivityItem[]>;
  /** The active view id, or null when the side view is collapsed. */
  value: MaybeFn<string | null | undefined>;
  onChange: (id: string | null) => void;
  /** Choosing the active view again collapses it (default true). */
  collapsible?: boolean;
  orientation?: "vertical" | "horizontal";
  /** id of the element the views are shown in (aria-controls). */
  controls?: string;
  label?: MaybeFn<string | undefined>;
  class?: ClassProp;
}

/** `<ActivityBar items={[{ id: "files", label: "Files", icon: files }, …]} value={$view} onChange={(v) => $view = v} controls="side" />` */
export function ActivityBar(props: ActivityBarProps): Element {
  const base = uid("hm-ab");
  const horizontal = props.orientation === "horizontal";
  const list = computed(() => val(props.items) ?? []);
  const current = (): string | null => val(props.value) ?? null;
  let root: HTMLElement | undefined, ind: HTMLElement | undefined;
  let lastAt: string | null = null;

  const choose = (it: ActivityItem): void => {
    if (it.onSelect) { void it.onSelect(); return; }
    props.onChange(current() === it.id && props.collapsible !== false ? null : it.id);
  };
  // the indicator glides from the old view to the new one
  effect(() => {
    const id = current();
    list();
    queueMicrotask(() => {
      const el = id ? root?.querySelector<HTMLElement>(`[data-view="${id}"]`) : null;
      if (!ind || !root) return;
      if (!el) { ind.classList.remove("is-on"); lastAt = null; return; }
      const box = root.getBoundingClientRect(), r = el.getBoundingClientRect();
      const to = horizontal ? `translateX(${(isRtl(root) ? r.right - box.right : r.left - box.left)}px)` : `translateY(${r.top - box.top}px)`;
      const size = horizontal ? r.width : r.height;
      setStyle(ind, { "--hm-ab-size": `${size}px` });
      const from = lastAt;
      lastAt = to;
      ind.classList.add("is-on");
      if (from && from !== to && !reducedMotion()) animate(ind, [{ transform: from }, { transform: to }], { duration: 260, easing: "easeOutBack", fill: "forwards" });
      else animate(ind, [{ transform: to, opacity: 0 }, { transform: to, opacity: 1 }], { duration: 160, fill: "forwards" });
    });
  });

  const tabs = (): HTMLElement[] => (root ? [...root.querySelectorAll<HTMLElement>('[role="tab"]')] : []);
  const button = (it: ActivityItem): unknown => {
    const on = (): boolean => !it.onSelect && current() === it.id;
    const name = (): string => { const l = val(it.label); return it.shortcut ? `${l} (${formatKey(it.shortcut)})` : l; };
    const btn = h("button", {
      type: "button", role: "tab", id: `${base}-${it.id}`, "data-view": it.id, class: () => cx("hm-ab-btn", on() && "is-active"),
      "aria-selected": () => String(on()), "aria-controls": props.controls ?? null, "aria-label": name, "aria-keyshortcuts": it.shortcut ?? null,
      tabindex: () => (on() || (!current() && untrack(list).find((x) => !x.onSelect)?.id === it.id) ? "0" : "-1"),
      onClick: () => choose(it),
    }, icon(it.icon, "hm-ab-icon"),
    it.badge !== undefined && h("span", { class: "hm-ab-badge" }, h(Badge, { count: () => val(it.badge), tone: "primary" })));
    return h(Tooltip, { text: name, placement: horizontal ? "top" : "bottom-start", children: btn });
  };
  const onKeydown = (e: KeyboardEvent): void => { roving(e, tabs(), { horizontal }); };

  return h("div", {
    class: () => cx("hm-ab", horizontal ? "hm-ab-h" : "hm-ab-v", val(props.class)), role: "tablist", "aria-orientation": horizontal ? "horizontal" : "vertical",
    "aria-label": () => val(props.label) ?? t`Views`, ref: (x: HTMLElement) => { root = x; }, onKeydown,
  },
  h("span", { class: "hm-ab-ind", "aria-hidden": "true", ref: (x: HTMLElement) => { ind = x; } }),
  h("div", { class: "hm-ab-group" }, () => list().filter((x) => x.position !== "end").map((x) => untrack(() => button(x)))),
  h("div", { class: "hm-ab-group hm-ab-end" }, () => list().filter((x) => x.position === "end").map((x) => untrack(() => button(x)))));
}
