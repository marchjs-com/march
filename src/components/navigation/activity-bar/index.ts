// ActivityBar (march/ui): the narrow icon bar at the edge of an editor that switches the side view (Files,
// Search, Source control…). A tablist: ↑ ↓ (← → when horizontal, mirrored in RTL) move, Enter / Space choose,
// choosing the active view again collapses it (value null). An indicator glides to the active view (motion engine).
// Items can sit at the end of the bar (settings, account) and carry count badges.
import "./activity-bar.css";
import { computed, effect, untrack, reactive } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { val, cx, icon, uid, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { Badge } from "../../../ui/badge.ts";
import { Tooltip } from "../../../ui/menu.ts";
import { TabList, type TabSpec } from "../tabs/index.ts";
import { labelWithKey } from "../../../ui/key-label.ts";
import { slidingIndicator } from "../../../motion/engine/indicator.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import type { Handler } from "../../../core/util.ts";

messages("tr", { "Views": "Görünümler" });

export interface ActivityItem {
  id: string;
  label: MaybeFn<string>;
  /** A shorter name for under the icon (`showLabels`); the accessible name and the tooltip stay `label`. */
  short?: MaybeFn<string | undefined>;
  icon: unknown;
  badge?: MaybeFn<number | null | undefined>;
  /** "end": at the far end of the bar (settings, account). */
  position?: "start" | "end";
  shortcut?: string;
  /** A plain action instead of a view (it is not selected). */
  onSelect?: Handler<[]> | undefined;
  /** Items under this one (`subItems`): `{ id, label, short, icon }`. */
  children?: readonly ActivityItem[];
}
export interface ActivityBarProps {
  /** The views: `{ id, label, short, icon, badge, position, shortcut, onSelect }` (an array or an accessor). @tr Görünümler: `{ id, label, short, icon, badge, position, shortcut, onSelect }` (dizi ya da erişimci). */
  items: MaybeFn<readonly ActivityItem[]>;
  /** The active view id, or null when the side view is collapsed. @tr Etkin görünümün id'si; yan görünüm kapalıyken null. */
  value: MaybeFn<string | null | undefined>;
  /** Called with the new id when a view is chosen (null when it collapses). @tr Bir görünüm seçilince yeni id ile (kapanınca null ile) çağrılır. */
  onChange: Handler<[id: string | null]>;
  /** Choosing the active view again collapses it (default true). @tr Etkin görünümü yeniden seçmek onu kapatır (varsayılan true). */
  collapsible?: boolean;
  /** vertical (default) or horizontal; live: the bar turns, the indicator moves to the other edge and keys follow the axis. @tr vertical (varsayılan) ya da horizontal; canlıdır: çubuk döner, gösterge öbür kenara geçer, tuşlar yeni ekseni izler. */
  orientation?: MaybeFn<"vertical" | "horizontal">;
  /** id of the element the views are shown in (aria-controls). @tr Görünümlerin gösterildiği öğenin id'si (aria-controls). */
  controls?: string;
  /** Accessible name of the bar (default "Views", translated). @tr Çubuğun erişilebilir adı (varsayılan "Views", çevrilir). */
  label?: MaybeFn<string | undefined>;
  /** The line that marks the active view (default true). @tr Etkin görünümü işaretleyen çizgi (varsayılan true). */
  indicator?: boolean | undefined;
  /** How the indicator moves to a new view: "glide" (default), "fade" (it appears in place) or "none". @tr Göstergenin yeni görünüme geçişi: "glide" (varsayılan), "fade" (yerinde belirir) ya da "none". */
  motion?: "glide" | "fade" | "none" | undefined;
  /** Name tooltips on hover and focus (default true; the accessible name stays either way). @tr Üzerine gelince ve odakta ad ipuçları (varsayılan true; erişilebilir ad her durumda kalır). */
  tooltips?: boolean | undefined;
  /** The name under each icon (an item's `short`, else its `label`): a wider bar, as a section rail or a phone tab bar (default false). @tr Her ikonun altında ad (öğenin `short`'u, yoksa `label`'ı): bölüm rayı ya da telefon sekme çubuğu gibi daha geniş bir çubuk (varsayılan false). */
  showLabels?: boolean | undefined;
  /** Frosted glass: the bar is see-through, what is behind shows blurred and a little richer, with a hairline glass edge and a light lip on top (`--m-glass-tint`, `--m-glass-blur`). @tr Buzlu cam: çubuk saydamdır, arkası bulanık ve biraz daha canlı görünür; ince bir cam kenarı ve üstte açık bir ışık çizgisi vardır (`--m-glass-tint`, `--m-glass-blur`). */
  glass?: MaybeFn<boolean>;
  /** The selected item's `children` fly out of it and line up right under it, one after another; choosing another item takes them away and brings its own (a section rail that shows the pages of the section you are in). @tr Seçili öğenin `children`'ı ondan uçarak çıkar ve hemen altına sırayla dizilir; başka bir öğe seçilince onlar kalkar, onunkiler gelir (bulunduğun bölümün sayfalarını gösteren bir bölüm rayı). */
  subItems?: boolean | undefined;
  /** The id of the child that is current (marked among the children). @tr Geçerli alt öğenin id'si (alt öğeler arasında işaretlenir). */
  subValue?: MaybeFn<string | null | undefined>;
  /** Called when a child is chosen (default: `onChange` with the child's id). @tr Bir alt öğe seçilince çağrılır (varsayılan: alt öğenin id'siyle `onChange`). */
  onSubSelect?: Handler<[child: ActivityItem, parent: ActivityItem]> | undefined;
  /** Extra class on the bar. @tr Çubuğa eklenen sınıf. */
  class?: ClassProp;
}

/** `<ActivityBar items={[{ id: "files", label: "Files", icon: files }, …]} value={$view} onChange={(v) => $view = v} controls="side" />` */
export function ActivityBar(props: ActivityBarProps): Element {
  const base = uid("m-ab");
  // orientation is live: the bar turns, the indicator moves to the other edge and keys follow the new axis
  const horizontal = (): boolean => val(props.orientation) === "horizontal";
  const list = computed(() => val(props.items) ?? []);
  const current = (): string | null => val(props.value) ?? null;
  const motion = props.motion ?? "glide";
  // start items first, then the ones at the far end; one tab strip (the TabList of Tabs: tablist, roving focus, selection)
  const ordered = computed(() => { const l = list(); return [...l.filter((x) => x.position !== "end"), ...l.filter((x) => x.position === "end")]; });
  const byId = (id: string): ActivityItem | undefined => untrack(list).find((x) => x.id === id);
  const name = (it: ActivityItem): string => labelWithKey(val(it.label), it.shortcut);

  const choose = (it: ActivityItem | undefined): void => {
    if (!it) return;
    if (it.onSelect) { void it.onSelect(); return; }
    props.onChange?.(current() === it.id && props.collapsible !== false ? null : it.id);
  };
  // the indicator glides from the old view to the new one (a turned bar starts it afresh)
  const ind = props.indicator !== false ? h("span", { class: "m-ab-ind", "aria-hidden": "true" }) as HTMLElement : null;
  if (ind) {
    let slide: ReturnType<typeof slidingIndicator> | undefined;
    effect(() => {
      const id = current();
      list(); horizontal();
      queueMicrotask(() => {
        const root = ind.parentElement;
        if (!root) return;
        slide ??= slidingIndicator(ind, root, { axis: () => (horizontal() ? "x" : "y"), sizeVar: "--m-ab-size", duration: 260, easing: "easeOutBack", motion: () => motion !== "none" });
        if (motion === "fade") slide.reset(); // appears in place
        // compared as text, not put into a selector (an id may hold quotes or brackets)
        slide.moveTo(id ? [...root.querySelectorAll<HTMLElement>("[data-view]")].find((el) => el.getAttribute("data-view") === id) ?? null : null);
      });
    });
  }

  // subItems: the selected item's children, right under it. Each flies out of the item (from its place, one after
  // another) as it comes; they go when another item is chosen
  const subs = (id: string): unknown => {
    if (current() !== id) return null;
    const parent = byId(id), kids = parent?.children;
    if (!parent || !kids?.length) return null;
    return untrack(() => h("div", { class: "m-ab-sub", role: "group", "aria-label": () => val(parent.label) },
      kids.map((k, i) => h("button", {
        type: "button", class: () => cx("m-ab-sub-btn", val(props.subValue) === k.id && "is-current"), "data-sub": k.id, "aria-label": () => val(k.label),
        "aria-current": () => (val(props.subValue) === k.id ? "page" : null), ref: (el: HTMLElement) => el.style.setProperty("--m-ab-i", String(i)),
        onClick: () => (props.onSubSelect ? props.onSubSelect(k, parent) : props.onChange?.(k.id)),
      }, icon(k.icon, "m-ab-icon"), props.showLabels && h("span", { class: "m-ab-text" }, () => val(k.short) ?? val(k.label))))));
  };
  const tabs = computed((): TabSpec[] => ordered().map((it) => ({
    id: it.id,
    label: [icon(it.icon, "m-ab-icon"), props.showLabels && h("span", { class: "m-ab-text" }, () => val(it.short) ?? val(it.label)), it.badge !== undefined && h("span", { class: "m-ab-badge" }, h(Badge, { count: () => val(it.badge), tone: "primary", size: "xs" }))],
  })));
  // an action is never the selected view
  const selected = (): string | null => { const id = current(); return id != null && !byId(id)?.onSelect ? id : null; };
  return h(TabList, {
    tabs, value: selected, onSelect: (id: string) => choose(byId(id)), orientation: reactive(() => (horizontal() ? "horizontal" : "vertical")) as never,
    activation: "manual", variant: "none", controls: props.controls, tabId: (id: string) => `${base}-${id}`,
    class: () => cx("m-ab", horizontal() ? "m-ab-h" : "m-ab-v", props.showLabels && "m-ab-labeled", val(props.glass) && "is-glass", val(props.class)), label: () => val(props.label) ?? t`Views`,
    tabProps: (tab: TabSpec) => { const it = byId(tab.id)!; return { class: cx("m-ab-btn", it.position === "end" && "m-ab-end"), "data-view": it.id, "aria-label": () => name(it), "aria-keyshortcuts": it.shortcut ?? null }; },
    wrap: (btn: Element, tab: TabSpec) => {
      const shown = props.tooltips === false ? btn : h(Tooltip, { text: () => name(byId(tab.id)!), placement: reactive(() => (horizontal() ? "top" : "bottom-start")) as never, children: btn });
      return props.subItems ? [shown, () => subs(tab.id)] : shown;
    },
    children: ind,
  }) as Element;
}
