// Breadcrumbs (hadi-march/ui): a path (folder › file › symbol). A crumb is a link, a button, or — with `siblings` —
// a menu of the items next to it (jump to another file in the same folder). When the path does not fit, the middle
// crumbs collapse into a "…" menu (the first and the last stay). Separators point the reading direction (RTL mirrored).
import "./breadcrumbs.css";
import { signal, computed, effect, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { val, cx, icon, glyph, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { Menu, type MenuItemSpec } from "../../../ui/menu.ts";
import { Link, type Href } from "../../../router/router.ts";
import { fitItems, observeWidth } from "../../../ui/fit.ts";
import { chevronRight } from "../../../icons/glyphs/chevronRight.ts";

messages("tr", { "Path": "Yol", "Hidden path parts": "Gizli yol parçaları", "{0}: go to": "{0}: şuraya git" });

export interface Crumb {
  id: string;
  label: MaybeFn<string>;
  icon?: unknown;
  href?: Href;
  onSelect?: () => unknown;
  /** Items beside this one: the crumb opens a menu of them. */
  siblings?: MaybeFn<readonly { id: string; label: string; icon?: unknown; onSelect: () => unknown }[] | undefined>;
}
export interface BreadcrumbsProps { items: MaybeFn<readonly Crumb[]>; label?: MaybeFn<string | undefined>; class?: ClassProp }

/** `<Breadcrumbs items={[{ id: "src", label: "src", siblings: folders }, { id: "app", label: "app.ts", icon: fileText }]} />` */
export function Breadcrumbs(props: BreadcrumbsProps): Element {
  const list = computed(() => val(props.items) ?? []);
  const shown = signal<boolean[]>([]);
  let ol: HTMLElement | undefined, widths: number[] = [], avail = 0;

  const refit = (): void => {
    const n = untrack(list).length;
    if (!ol || widths.length !== n) return;
    // the last crumb matters most, then the first, then the ones nearer the end
    const prio = widths.map((_, i) => (i === n - 1 ? 1e6 : i === 0 ? 1e5 : i));
    const next = fitItems(widths, prio, avail, 36);
    const before = untrack(shown);
    if (next.length !== before.length || next.some((v, i) => v !== before[i])) shown.set(next);
  };
  effect(() => { list(); untrack(() => { shown.set([]); queueMicrotask(() => { if (!ol) return; widths = [...ol.querySelectorAll<HTMLElement>(":scope > .hm-bc-li:not(.hm-bc-more)")].map((c) => c.offsetWidth || 0); refit(); }); }); });
  const isShown = (i: number): boolean => shown()[i] !== false;
  const hidden = computed(() => list().filter((_, i) => !isShown(i)));

  const sep = (): Element => h("span", { class: "hm-bc-sep", "aria-hidden": "true" }, glyph(chevronRight));
  const crumb = (c: Crumb, last: boolean): unknown => {
    const body = [icon(c.icon, "hm-bc-icon"), h("span", { class: "hm-bc-label" }, () => val(c.label))];
    const sib = (): MenuItemSpec[] => (val(c.siblings) ?? []).map((s) => ({ label: s.label, icon: s.icon, onSelect: s.onSelect }));
    if (c.siblings) return h(Menu, { trigger: body, label: () => t`${val(c.label)}: go to`, items: sib, variant: "ghost", size: "sm", class: cx("hm-bc-item", last && "is-current"), placement: "bottom-start" });
    if (c.href && !last) return h(Link, { href: c.href, class: "hm-bc-item", children: body });
    if (c.onSelect && !last) return h("button", { type: "button", class: "hm-bc-item", onClick: () => void c.onSelect?.() }, body);
    return h("span", { class: cx("hm-bc-item", last && "is-current"), "aria-current": last ? "page" : null }, body);
  };

  return h("nav", { class: () => cx("hm-bc", val(props.class)), "aria-label": () => val(props.label) ?? t`Path`, ref: (x: HTMLElement) => { observeWidth(x, (w) => { avail = w; refit(); }); } },
    h("ol", { class: "hm-bc-ol", ref: (x: HTMLElement) => { ol = x; } }, () => {
      const items = list();
      return untrack(() => items.map((c, i) => [
        // the collapsed middle sits right after the first crumb
        i === 1 ? h("li", { class: "hm-bc-li hm-bc-more", hidden: () => hidden().length === 0 },
          h(Menu, { trigger: "…", label: () => t`Hidden path parts`, variant: "ghost", size: "sm", class: "hm-bc-item",
            items: () => hidden().map((x): MenuItemSpec => ({ label: () => val(x.label), icon: x.icon, onSelect: () => void (x.onSelect?.()), ...(x.href ? { href: x.href } : {}) })) }), sep()) : null,
        h("li", { class: "hm-bc-li", hidden: () => !isShown(i) }, crumb(c, i === items.length - 1), i < items.length - 1 ? sep() : null),
      ]));
    }));
}
