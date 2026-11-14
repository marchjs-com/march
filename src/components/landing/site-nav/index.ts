// SiteNav (hadi-march/landing): the top bar of a website. Sticky; `transparent` starts see-through over a hero and
// turns solid (glass) after a few pixels of scroll; `floating` is a centred glass pill; `shrink` makes it lower once
// scrolled; `hide` slides it away while scrolling down and back on scrolling up. A pill slides under the hovered link
// (motion engine, mirrored in RTL) and rests on the current one. On narrow screens the links move into a Drawer.
import "./site-nav.css";
import { h } from "../../../dom/h.ts";
import { signal } from "../../../core/reactive.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, listen, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { owned } from "../../../ui/observe.ts";
import { Brand, type BrandProps } from "../../../ui/app.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { openDrawer } from "../../../ui/dialog.ts";
import { menu } from "../../../icons/glyphs/menu.ts";
import { reducedMotion } from "../../../motion/engine/prefs.ts";
import { slidingIndicator } from "../../../motion/engine/parts.ts";
import { onScrollProgress } from "../../../motion/scroll-fx.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

export interface SiteNavLink { label: unknown; href: string; active?: MaybeFn<boolean | undefined> }
export interface SiteNavProps {
  /** A Brand (props) or any node. */
  brand: BrandProps | Node;
  links?: readonly SiteNavLink[] | undefined;
  /** Buttons at the end (sign in, primary call to action). Also shown in the mobile drawer. */
  actions?: unknown | undefined;
  /** solid (default) · transparent until scrolled · floating glass pill. */
  mode?: "solid" | "transparent" | "floating" | undefined;
  /** Lower bar once scrolled (default true). */
  shrink?: boolean | undefined;
  /** Slide away while scrolling down (default false). */
  hide?: boolean | undefined;
  /** Pixels of scroll before it counts as scrolled (default 12). */
  threshold?: number | undefined;
  /** The scrolling element that shrink / hide / transparent follow (default: the page). A function is read once mounted. */
  source?: Element | (() => Element | null | undefined) | null | undefined;
  /** Sticky (default) or static. */
  sticky?: boolean | undefined;
  /** Called when a link is chosen (desktop or drawer). */
  onNavigate?: (href: string) => void | undefined;
  /** The pill that slides under the hovered link and rests on the current one (default true). */
  pill?: boolean | undefined;
  /** Colour of the pill (default: a soft neutral). */
  pillColor?: ColorToken | undefined;
  /** The menu button of narrow screens (default true); false when you open your own menu. */
  menu?: boolean | undefined;
  /** Icon of the menu button (default: three lines). */
  menuIcon?: unknown | undefined;
  /** Side the drawer opens from (default "right"). */
  drawerSide?: "left" | "right" | undefined;
  /** Own texts: accessible name of the navigation ("Main"), name of the menu button ("Open menu"), title of the drawer ("Menu"). */
  labels?: { main?: string | undefined; openMenu?: string | undefined; menu?: string | undefined } | undefined;
  class?: ClassProp | undefined;
}

const brandNode = (b: BrandProps | Node): unknown => ((b as Node).nodeType ? b : h(Brand, b as BrandProps));

/**
 * An in-page link (`#pricing`) scrolls to its section itself, so it also works under a hash router. A section that is
 * not in the document yet (a lazy part below the fold) is reached by scrolling down until it arrives. True when handled.
 */
function toSection(e: Event, href: string): boolean {
  if (!href.startsWith("#") || href.length < 2) return false;
  e.preventDefault();
  const id = decodeURIComponent(href.slice(1));
  const smooth = !reducedMotion();
  let tries = 0;
  const go = (): void => {
    const target = globalThis.document?.getElementById(id);
    if (target) { target.scrollIntoView?.({ behavior: smooth ? "smooth" : "auto", block: "start" }); return; }
    if (++tries > 12) return;
    globalThis.scrollBy?.({ top: (globalThis.innerHeight || 800) * 0.9 });
    setTimeout(go, 160);
  };
  go();
  return true;
}

/** `<SiteNav brand={{ name: "HADİ", mark: logo, href: "/" }} links={[{ label: "Pricing", href: "#pricing" }]} actions={<Button>Start</Button>} mode="transparent" />` */
export function SiteNav(props: SiteNavProps): Element {
  const scrolled = signal(false), hidden = signal(false);
  const links = props.links ?? [];
  const L = props.labels ?? {};
  const pill = h("span", { class: "hm-snav-pill", "aria-hidden": "true", "data-hm-color": colorAttr(props.pillColor) }) as HTMLElement;
  const anchors: HTMLElement[] = [];
  const list = h("ul", { class: "hm-snav-links" }, props.pill === false ? null : pill, links.map((l) => {
    const a = h("a", { class: "hm-snav-link", href: l.href, "aria-current": () => (val(l.active) ? "page" : null), onClick: (e: Event) => { toSection(e, l.href); props.onNavigate?.(l.href); } }, l.label) as HTMLElement;
    anchors.push(a);
    return h("li", {}, a);
  })) as HTMLElement;

  // the sliding pill: the shared sliding indicator (final place set at once, the move played from the old place; RTL mirrored)
  const slide = slidingIndicator(pill, list, { enter: "pop" });
  const moveTo = (a: HTMLElement | null): void => { if (props.pill !== false) slide.moveTo(a); };
  const current = (): HTMLElement | null => anchors.find((_, i) => val(links[i]?.active)) ?? null;
  const offList = listen(list, {
    pointerover: (e: PointerEvent) => { const a = (e.target as Element).closest?.(".hm-snav-link") as HTMLElement | null; if (a) moveTo(a); },
    pointerleave: () => moveTo(current()),
    focusin: (e: FocusEvent) => moveTo((e.target as Element).closest?.(".hm-snav-link") as HTMLElement | null),
    focusout: () => moveTo(current()),
  });

  const openMenu = (): void => {
    void openDrawer((close) => h("nav", { class: "hm-snav-drawer", "aria-label": L.main ?? t`Main` },
      h("ul", {}, links.map((l) => h("li", {}, h("a", { class: "hm-snav-drawer-link", href: l.href, "aria-current": () => (val(l.active) ? "page" : null), onClick: (e: Event) => { close(undefined); toSection(e, l.href); props.onNavigate?.(l.href); } }, l.label)))),
      props.actions != null && h("div", { class: "hm-snav-drawer-actions" }, props.actions)), { side: props.drawerSide ?? "right", title: L.menu ?? t`Menu` });
  };

  const threshold = props.threshold ?? 12;
  let lastY = 0, offScroll = (): void => {}, gone = false;
  const watch = (box: Element | null): void => {
    if (gone) return;
    offScroll = onScrollProgress(box ? { source: box } : {}, () => {
      const y = (box ? box.scrollTop : globalThis.scrollY) || 0;
      scrolled.set(y > threshold);
      if (props.hide) { const down = y > lastY; if (Math.abs(y - lastY) > 4) hidden.set(down && y > 120); }
      lastY = y;
    });
  };
  // a scroll container given as a function (a ref of an element around the bar) exists only once the bar is placed
  const source = props.source;
  if (typeof source === "function") queueMicrotask(() => watch(source() ?? null)); else watch(source ?? null);
  const mode = props.mode ?? "solid";
  const nav = h("header", {
    class: () => cx("hm-snav", `hm-snav-${mode}`, props.sticky !== false && "is-sticky", props.shrink !== false && "hm-snav-shrinks", scrolled() && "is-scrolled", hidden() && "is-hidden", val(props.class)),
  },
  h("div", { class: "hm-snav-bar" },
    h("div", { class: "hm-snav-brand" }, brandNode(props.brand)),
    links.length ? h("nav", { class: "hm-snav-nav", "aria-label": L.main ?? t`Main` }, list) : null,
    h("div", { class: "hm-snav-actions" }, props.actions ?? null),
    links.length && props.menu !== false ? h(IconButton, { class: "hm-snav-menu", icon: props.menuIcon ?? menu, label: () => L.openMenu ?? t`Open menu`, onClick: openMenu }) : null)) as HTMLElement;
  // rest on the current link once laid out
  queueMicrotask(() => { if (nav.isConnected) moveTo(current()); });
  owned(() => { gone = true; offList(); offScroll(); });
  return nav;
}
