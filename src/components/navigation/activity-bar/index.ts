// ActivityBar (hadi-march/ui): the narrow icon bar at the edge of an editor that switches the side view (Files,
// Search, Source control…). A tablist: ↑ ↓ (← → when horizontal, mirrored in RTL) move, Enter / Space choose,
// choosing the active view again collapses it (value null). An indicator glides to the active view (motion engine).
// Items can sit at the end of the bar (settings, account) and carry count badges.
import "./activity-bar.css";
import { computed, effect, untrack, reactive } from "../../../core/reactive.ts";
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
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

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
  orientation?: MaybeFn<"vertical" | "horizontal">;
  /** id of the element the views are shown in (aria-controls). */
  controls?: string;
  label?: MaybeFn<string | undefined>;
  /** The line that marks the active view (default true). */
  indicator?: boolean | undefined;
  /** How the indicator moves to a new view: "glide" (default), "fade" (it appears in place) or "none". */
  motion?: "glide" | "fade" | "none" | undefined;
  /** Name tooltips on hover and focus (default true; the accessible name stays either way). */
  tooltips?: boolean | undefined;
  /** Theme color token of the active view and the indicator (default: the theme's primary). */
  color?: ColorToken | undefined;
  class?: ClassProp;
}

/** `<ActivityBar items={[{ id: "files", label: "Files", icon: files }, …]} value={$view} onChange={(v) => $view = v} controls="side" />` */
export function ActivityBar(props: ActivityBarProps): Element {
  const base = uid("hm-ab");
  // orientation is live: the bar turns, the indicator moves to the other edge and keys follow the new axis
  const horizontal = (): boolean => val(props.orientation) === "horizontal";
  const list = computed(() => val(props.items) ?? []);
  const current = (): string | null => val(props.value) ?? null;
  let root: HTMLElement | undefined, ind: HTMLElement | undefined;
  let lastAt: string | null = null;
  const motion = props.motion ?? "glide";

  const choose = (it: ActivityItem): void => {
    if (it.onSelect) { void it.onSelect(); return; }
    props.onChange(current() === it.id && props.collapsible !== false ? null : it.id);
  };
  // the indicator glides from the old view to the new one
  if (props.indicator !== false) effect(() => {
    const id = current();
    list();
    const hz = horizontal();
    queueMicrotask(() => {
      const el = id ? root?.querySelector<HTMLElement>(`[data-view="${id}"]`) : null;
      if (!ind || !root) return;
      if (!el) { ind.classList.remove("is-on"); lastAt = null; return; }
      const box = root.getBoundingClientRect(), r = el.getBoundingClientRect();
      const to = hz ? `translateX(${(isRtl(root) ? r.right - box.right : r.left - box.left)}px)` : `translateY(${r.top - box.top}px)`;
      const size = hz ? r.width : r.height;
      setStyle(ind, { "--hm-ab-size": `${size}px` });
      // a turned bar starts the indicator afresh (a glide from the other axis would cross the bar)
      const from = lastAt && lastAt.startsWith(hz ? "translateX" : "translateY") ? lastAt : null;
      lastAt = to;
      ind.classList.add("is-on");
      if (motion === "none") setStyle(ind, { transform: to });
      else if (motion === "glide" && from && from !== to && !reducedMotion()) animate(ind, [{ transform: from }, { transform: to }], { duration: 260, easing: "easeOutBack", fill: "forwards" });
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
    if (props.tooltips === false) return btn;
    return h(Tooltip, { text: name, placement: reactive(() => (horizontal() ? "top" : "bottom-start")) as never, children: btn });
  };
  const onKeydown = (e: KeyboardEvent): void => { roving(e, tabs(), { horizontal: horizontal() }); };

  return h("div", {
    class: () => cx("hm-ab", horizontal() ? "hm-ab-h" : "hm-ab-v", val(props.class)), role: "tablist", "aria-orientation": () => (horizontal() ? "horizontal" : "vertical"),
    "aria-label": () => val(props.label) ?? t`Views`, "data-hm-color": () => colorAttr(props.color), ref: (x: HTMLElement) => { root = x; }, onKeydown,
  },
  props.indicator !== false && h("span", { class: "hm-ab-ind", "aria-hidden": "true", ref: (x: HTMLElement) => { ind = x; } }),
  h("div", { class: "hm-ab-group" }, () => list().filter((x) => x.position !== "end").map((x) => untrack(() => button(x)))),
  h("div", { class: "hm-ab-group hm-ab-end" }, () => list().filter((x) => x.position === "end").map((x) => untrack(() => button(x)))));
}
