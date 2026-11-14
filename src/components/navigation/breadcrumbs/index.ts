// Breadcrumbs (hadi-march/ui): a path (folder › file › symbol). A crumb is a link, a button, or — with `siblings` —
// a menu of the items next to it (jump to another file in the same folder). When the path does not fit, the middle
// crumbs collapse into a "…" menu (the first and the last stay). Separators point the reading direction (RTL mirrored).
import "./breadcrumbs.css";
import { computed, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { val, cx, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { Button } from "../../actions/button/index.ts";
import { OverflowText } from "../../typography/overflow-text/index.ts";
import { Menu, type MenuItemSpec } from "../../../ui/menu.ts";
import type { Href } from "../../../router/router.ts";
import { overflowFit } from "../../../ui/fit.ts";
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
export interface BreadcrumbsProps {
  items: MaybeFn<readonly Crumb[]>;
  label?: MaybeFn<string | undefined>;
  /** Between the crumbs: the chevron (default), your own icon, short text ("/") or `() => node`, or false for none. */
  separator?: unknown;
  /** Collapse the middle into a "…" menu when the path does not fit (default true); false: the path is clipped instead. */
  collapse?: boolean | undefined;
  /** Content of the collapsed-crumbs trigger (default "…"). */
  ellipsis?: unknown;
  /** Accessible names: the "…" menu, and `goTo(name)` for the menu of a crumb with siblings. */
  labels?: { more?: MaybeFn<string | undefined>; goTo?: ((name: string) => string) | undefined } | undefined;
  class?: ClassProp;
}

/** `<Breadcrumbs items={[{ id: "src", label: "src", siblings: folders }, { id: "app", label: "app.ts", icon: fileText }]} />` */
export function Breadcrumbs(props: BreadcrumbsProps): Element {
  const list = computed(() => val(props.items) ?? []);
  let ol: HTMLElement | undefined;
  const fit = overflowFit({
    items: list, enabled: () => props.collapse !== false, reserve: () => 36,
    measure: () => (ol ? [...ol.querySelectorAll<HTMLElement>(":scope > .hm-bc-li:not(.hm-bc-more)")].map((c) => c.offsetWidth || 0) : null),
    // the last crumb matters most, then the first, then the ones nearer the end
    priority: (i, n) => (i === n - 1 ? 1e6 : i === 0 ? 1e5 : i),
  });
  const { isShown } = fit;
  const hidden = computed(() => list().filter((_, i) => !isShown(i)));

  const own = props.separator, goTo = props.labels?.goTo;
  const sep = (): Element | null => (own === false ? null : h("span", { class: "hm-bc-sep", "aria-hidden": "true" }, ownIcon(own ?? undefined, chevronRight, null)));
  const crumb = (c: Crumb, last: boolean): unknown => {
    const body = [icon(c.icon, "hm-bc-icon"), h(OverflowText, { class: "hm-bc-label", fade: false }, () => val(c.label))];
    const sib = (): MenuItemSpec[] => (val(c.siblings) ?? []).map((s) => ({ label: s.label, icon: s.icon, onSelect: s.onSelect }));
    if (c.siblings) return h(Menu, { trigger: body, label: () => (goTo ? goTo(val(c.label)) : t`${val(c.label)}: go to`), items: sib, variant: "ghost", size: "sm", class: cx("hm-bc-item", last && "is-current"), placement: "bottom-start" });
    // a link or a button crumb: a ghost Button in the crumb's look (the content goes in unwrapped, like a Menu trigger's)
    if ((c.href || c.onSelect) && !last) return h(Button, { variant: "ghost", size: "sm", class: "hm-bc-item", icon: body, ...(c.href ? { href: c.href } : { onClick: () => void c.onSelect?.() }) });
    return h("span", { class: cx("hm-bc-item", last && "is-current"), "aria-current": last ? "page" : null }, body);
  };

  return h("nav", { class: () => cx("hm-bc", val(props.class)), "aria-label": () => val(props.label) ?? t`Path`, ref: (x: HTMLElement) => { fit.observe(x); } },
    h("ol", { class: "hm-bc-ol", ref: (x: HTMLElement) => { ol = x; } }, () => {
      const items = list();
      return untrack(() => items.map((c, i) => [
        // the collapsed middle sits right after the first crumb
        i === 1 ? h("li", { class: "hm-bc-li hm-bc-more", hidden: () => hidden().length === 0 },
          h(Menu, { trigger: props.ellipsis ?? "…", label: () => val(props.labels?.more) ?? t`Hidden path parts`, variant: "ghost", size: "sm", class: "hm-bc-item",
            items: () => hidden().map((x): MenuItemSpec => ({ label: () => val(x.label), icon: x.icon, onSelect: () => void (x.onSelect?.()), ...(x.href ? { href: x.href } : {}) })) }), sep()) : null,
        h("li", { class: "hm-bc-li", hidden: () => !isShown(i) }, crumb(c, i === items.length - 1), i < items.length - 1 ? sep() : null),
      ]));
    }));
}
