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
  siblings?: MaybeFn<readonly CrumbSibling[] | undefined>;
}
/** An item beside a crumb: a link (`href`: opens in a new tab with a middle click) or an action (`onSelect`). */
export interface CrumbSibling {
  id: string;
  label: string;
  icon?: unknown;
  /** A second, quieter line under the label. */
  sub?: string | undefined;
  href?: Href | undefined;
  onSelect?: (() => unknown) | undefined;
  /** The one the path goes through now: marked in the menu. */
  current?: boolean | undefined;
}
export interface BreadcrumbsProps {
  /** The crumbs: `{ id, label, icon, href, onSelect, siblings }` (an array or an accessor). @tr Kırıntılar: `{ id, label, icon, href, onSelect, siblings }` (dizi ya da erişimci). */
  items: MaybeFn<readonly Crumb[]>;
  /** Accessible name of the nav (default "Path", translated). @tr nav öğesinin erişilebilir adı (varsayılan "Path", çevrilir). */
  label?: MaybeFn<string | undefined>;
  /** Between the crumbs: the chevron (default), your own icon, short text ("/") or `() => node`, or false for none. @tr Kırıntılar arasında: ok (varsayılan), kendi ikonun, kısa metin ("/") ya da `() => node`; false ile hiçbir şey. */
  separator?: unknown;
  /** Collapse the middle into a "…" menu when the path does not fit (default true); false: the path is clipped instead. @tr Yol sığmazsa ortası "…" menüsüne katlanır (varsayılan true); false: yol kırpılır. */
  collapse?: boolean | undefined;
  /** Content of the collapsed-crumbs trigger (default "…"). @tr Katlanmış kırıntılar düğmesinin içeriği (varsayılan "…"). */
  ellipsis?: unknown;
  /** Accessible names: the "…" menu, and `goTo(name)` for the menu of a crumb with siblings. @tr Erişilebilir adlar: "…" menüsü ve kardeşleri olan bir kırıntının menüsü için `goTo(name)`. */
  labels?: { more?: MaybeFn<string | undefined>; goTo?: ((name: string) => string) | undefined } | undefined;
  /** Extra class on the nav. @tr nav öğesine eklenen sınıf. */
  class?: ClassProp;
}

/** `<Breadcrumbs items={[{ id: "src", label: "src", siblings: folders }, { id: "app", label: "app.ts", icon: fileText }]} />` */
export function Breadcrumbs(props: BreadcrumbsProps): Element {
  const list = computed(() => val(props.items) ?? []);
  let ol: HTMLElement | undefined;
  const fit = overflowFit({
    items: list, enabled: () => props.collapse !== false, reserve: () => 36,
    // a crumb squeezed by its neighbours counts with the width its name wants (up to the crumb's widest), so the middle
    // folds away before the last crumb is squeezed to nothing
    measure: () => (ol ? [...ol.querySelectorAll<HTMLElement>(":scope > .m-bc-li:not(.m-bc-more)")].map((c) => {
      const w = c.offsetWidth || 0, name = c.querySelector<HTMLElement>(".m-bc-label");
      const cut = name ? Math.max(0, name.scrollWidth - name.clientWidth) : 0;
      return cut ? Math.min(w + cut, Math.max(w, 240)) : w;
    }) : null),
    // the last crumb matters most, then the first, then the ones nearer the end
    priority: (i, n) => (i === n - 1 ? 1e6 : i === 0 ? 1e5 : i),
  });
  const { isShown } = fit;
  const hidden = computed(() => list().filter((_, i) => !isShown(i)));

  const own = props.separator, goTo = props.labels?.goTo;
  const sep = (): Element | null => (own === false ? null : h("span", { class: "m-bc-sep", "aria-hidden": "true" }, ownIcon(own ?? undefined, chevronRight, null)));
  const crumb = (c: Crumb, last: boolean): unknown => {
    const body = [icon(c.icon, "m-bc-icon"), h(OverflowText, { class: "m-bc-label", fade: false }, () => val(c.label))];
    const sib = (): MenuItemSpec[] => (val(c.siblings) ?? []).map((s) => ({
      label: s.label, icon: s.icon, ...(s.sub ? { sub: s.sub } : {}), ...(s.current !== undefined ? { current: s.current } : {}),
      ...(s.href ? { href: s.href } : { onSelect: () => void s.onSelect?.() }),
    }));
    if (c.siblings) return h(Menu, { trigger: body, label: () => (goTo ? goTo(val(c.label)) : t`${val(c.label)}: go to`), items: sib, variant: "ghost", size: "sm", class: cx("m-bc-item", last && "is-current"), placement: "bottom-start" });
    // a link or a button crumb: a ghost Button in the crumb's look (the content goes in unwrapped, like a Menu trigger's)
    if ((c.href || c.onSelect) && !last) return h(Button, { variant: "ghost", size: "sm", class: "m-bc-item", icon: body, ...(c.href ? { href: c.href } : { onClick: () => void c.onSelect?.() }) });
    return h("span", { class: cx("m-bc-item", last && "is-current"), "aria-current": last ? "page" : null }, body);
  };

  return h("nav", { class: () => cx("m-bc", val(props.class)), "aria-label": () => val(props.label) ?? t`Path`, ref: (x: HTMLElement) => { fit.observe(x); } },
    h("ol", { class: "m-bc-ol", ref: (x: HTMLElement) => { ol = x; } }, () => {
      const items = list();
      return untrack(() => items.map((c, i) => [
        // the collapsed middle sits right after the first crumb
        i === 1 ? h("li", { class: "m-bc-li m-bc-more", hidden: () => hidden().length === 0 },
          h(Menu, { trigger: props.ellipsis ?? "…", label: () => val(props.labels?.more) ?? t`Hidden path parts`, variant: "ghost", size: "sm", class: "m-bc-item",
            items: () => hidden().map((x): MenuItemSpec => ({ label: () => val(x.label), icon: x.icon, onSelect: () => void (x.onSelect?.()), ...(x.href ? { href: x.href } : {}) })) }), sep()) : null,
        h("li", { class: "m-bc-li", hidden: () => !isShown(i) }, crumb(c, i === items.length - 1), i < items.length - 1 ? sep() : null),
      ]));
    }));
}
