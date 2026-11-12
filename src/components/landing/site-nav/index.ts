// SiteNav (hadi-march/landing): the top bar of a website. Sticky; `transparent` starts see-through over a hero and
// turns solid (glass) after a few pixels of scroll; `floating` is a centred glass pill; `shrink` makes it lower once
// scrolled; `hide` slides it away while scrolling down and back on scrolling up. A pill slides under the hovered link
// (motion engine, mirrored in RTL) and rests on the current one. On narrow screens the links move into a Drawer.
import "./site-nav.css";
import { h } from "../../../dom/h.ts";
import { signal, onCleanup, getOwner } from "../../../core/reactive.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, glyph, listen, setStyle, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { Brand, type BrandProps } from "../../../ui/app.ts";
import { IconButton } from "../../../ui/button.ts";
import { openDrawer } from "../../../ui/dialog.ts";
import { menu } from "../../../icons/glyphs/menu.ts";
import { animate } from "../../../motion/engine/playback.ts";
import { reducedMotion } from "../../../motion/engine/prefs.ts";
import { scrollScene } from "../../../motion/scroll-scene.ts";

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
  /** Sticky (default) or static. */
  sticky?: boolean | undefined;
  /** Called when a link is chosen (desktop or drawer). */
  onNavigate?: (href: string) => void | undefined;
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
  const smooth = !globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
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

/** `<SiteNav brand={{ name: "Acme", mark: logo, href: "/" }} links={[{ label: "Pricing", href: "#pricing" }]} actions={<Button>Start</Button>} mode="transparent" />` */
export function SiteNav(props: SiteNavProps): Element {
  const scrolled = signal(false), hidden = signal(false);
  const links = props.links ?? [];
  const pill = h("span", { class: "hm-snav-pill", "aria-hidden": "true" }) as HTMLElement;
  const anchors: HTMLElement[] = [];
  const list = h("ul", { class: "hm-snav-links" }, pill, links.map((l) => {
    const a = h("a", { class: "hm-snav-link", href: l.href, "aria-current": () => (val(l.active) ? "page" : null), onClick: (e: Event) => { toSection(e, l.href); props.onNavigate?.(l.href); } }, l.label) as HTMLElement;
    anchors.push(a);
    return h("li", {}, a);
  })) as HTMLElement;

  // the sliding pill: final place set at once, the motion engine plays the move from the old place (FLIP)
  let shown = false, last = { x: 0, w: 0 };
  const moveTo = (a: HTMLElement | null): void => {
    if (!a) { if (shown) { animate(pill, { opacity: [1, 0] }, { duration: 160, easing: "out" }); setStyle(pill, { opacity: "0" }); shown = false; } return; }
    const r = list.getBoundingClientRect(), b = a.getBoundingClientRect();
    const rtl = globalThis.getComputedStyle?.(list).direction === "rtl";
    const x = rtl ? b.right - r.right : b.left - r.left, w = b.width;
    setStyle(pill, { width: `${w}px`, transform: `translateX(${x}px)`, opacity: "1" });
    if (!reducedMotion()) {
      if (shown && last.w) animate(pill, { transform: [`translateX(${last.x}px) scaleX(${(last.w / w).toFixed(4)})`, `translateX(${x}px) scaleX(1)`] }, { duration: 320, easing: "expo" });
      else animate(pill, { opacity: [0, 1], transform: [`translateX(${x}px) scale(.9)`, `translateX(${x}px) scale(1)`] }, { duration: 200, easing: "out" });
    }
    shown = true; last = { x, w };
  };
  const current = (): HTMLElement | null => anchors.find((_, i) => val(links[i]?.active)) ?? null;
  const offList = listen(list, {
    pointerover: (e: PointerEvent) => { const a = (e.target as Element).closest?.(".hm-snav-link") as HTMLElement | null; if (a) moveTo(a); },
    pointerleave: () => moveTo(current()),
    focusin: (e: FocusEvent) => moveTo((e.target as Element).closest?.(".hm-snav-link") as HTMLElement | null),
    focusout: () => moveTo(current()),
  });

  const openMenu = (): void => {
    void openDrawer((close) => h("nav", { class: "hm-snav-drawer", "aria-label": t`Main` },
      h("ul", {}, links.map((l) => h("li", {}, h("a", { class: "hm-snav-drawer-link", href: l.href, "aria-current": () => (val(l.active) ? "page" : null), onClick: (e: Event) => { close(undefined); toSection(e, l.href); props.onNavigate?.(l.href); } }, l.label)))),
      props.actions != null && h("div", { class: "hm-snav-drawer-actions" }, props.actions)), { side: "right", title: t`Menu` });
  };

  const threshold = props.threshold ?? 12;
  let lastY = 0;
  scrollScene(null, (s) => {
    scrolled.set(s.scrollY > threshold);
    if (props.hide) { const down = s.scrollY > lastY; if (Math.abs(s.scrollY - lastY) > 4) hidden.set(down && s.scrollY > 120); }
    lastY = s.scrollY;
  });
  const mode = props.mode ?? "solid";
  const nav = h("header", {
    class: () => cx("hm-snav", `hm-snav-${mode}`, props.sticky !== false && "is-sticky", props.shrink !== false && "hm-snav-shrinks", scrolled() && "is-scrolled", hidden() && "is-hidden", val(props.class)),
  },
  h("div", { class: "hm-snav-bar" },
    h("div", { class: "hm-snav-brand" }, brandNode(props.brand)),
    links.length ? h("nav", { class: "hm-snav-nav", "aria-label": t`Main` }, list) : null,
    h("div", { class: "hm-snav-actions" }, props.actions ?? null),
    links.length ? h(IconButton, { class: "hm-snav-menu", label: () => t`Open menu`, onClick: openMenu }, glyph(menu)) : null)) as HTMLElement;
  // rest on the current link once laid out
  queueMicrotask(() => { if (nav.isConnected) moveTo(current()); });
  if (getOwner()) onCleanup(offList);
  return nav;
}
