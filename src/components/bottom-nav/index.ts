// BottomNav (hadi-march/ui): the mobile tab bar. A colored bubble slides to the active tab (motion engine, FLIP), the
// active icon pops, tabs carry count / dot badges, and an optional raised Create button in the middle wears a slowly
// turning ring of the four HADİ colors (decorative: it stays still with reduced motion).
import { effect, untrack, onCleanup } from "../../core/reactive.ts";
import { h } from "../../dom/h.ts";
import { t } from "../../core/i18n.ts";
import { val, cx, icon, glyph, type MaybeFn, type ClassProp } from "../../ui/util.ts";
import { Badge } from "../../ui/badge.ts";
import { OverflowText } from "../../ui/marquee.ts";
import { colorAttr, type ColorToken } from "../../theme/colors.ts";
import { plus } from "../../icons/glyphs/plus.ts";
import { animate } from "../../motion/animate.ts";
import { setStyle } from "../../motion/env.ts";
import "./bottom-nav.css";

export interface BottomNavItem {
  id: string;
  label: MaybeFn<string>;
  icon?: unknown;
  /** Icon while active (default: `icon`). */
  activeIcon?: unknown;
  /** Count badge (hidden at 0; 120 → "99+"). */
  badge?: MaybeFn<number | null | undefined>;
  /** A dot instead of a count. */
  dot?: MaybeFn<boolean | undefined>;
  /** Bubble color while active (tint "brand"). Default: the four HADİ colors in turn. */
  color?: ColorToken | undefined;
  /** Render as a link. */
  href?: string | undefined;
}

export interface BottomNavProps {
  items: readonly BottomNavItem[];
  /** Active item id. */
  value: MaybeFn<string | null | undefined>;
  onChange?: ((id: string) => void) | undefined;
  /** Shows the raised Create button in the middle. */
  onCreate?: (() => void) | undefined;
  createLabel?: MaybeFn<string | undefined>;
  createIcon?: unknown;
  /** Ring colors of the Create button (CSS colors). Default: the four HADİ colors (a theme's brand tokens first). */
  ring?: readonly string[] | undefined;
  /** Show labels under the icons. Default true (the label stays the accessible name either way). */
  labels?: MaybeFn<boolean | undefined>;
  /** floating: a rounded bar with room around it · flat: edge to edge. Default floating. */
  variant?: MaybeFn<"floating" | "flat" | undefined>;
  /** brand: each tab's own color · accent: the theme accent for all. Default brand. */
  tint?: MaybeFn<"brand" | "accent" | undefined>;
  /** Accessible name of the navigation landmark. */
  label?: MaybeFn<string | undefined>;
  class?: ClassProp;
}

const CYCLE: ColorToken[] = ["brand-orange", "brand-blue", "brand-green", "brand-purple"];
/** The four HADİ colors: Heyecan, Aktivite, Dostluk, İletişim (a theme that defines its brand tokens wins). */
export const HADI_RING: readonly string[] = ["var(--hm-brand-orange, #F2801F)", "var(--hm-brand-blue, #1D9AD6)", "var(--hm-brand-green, #78BE3A)", "var(--hm-brand-purple, #A3338C)"];

/** `<BottomNav items={tabs} value={$tab} onChange={(id) => $tab = id} onCreate={compose} />` */
export function BottomNav(props: BottomNavProps): Element {
  const items = props.items;
  const create = props.onCreate != null;
  const createAt = create ? Math.floor(items.length / 2) : -1;
  const slots = items.length + (create ? 1 : 0);
  const slotOf = (i: number): number => (create && i >= createAt ? i + 1 : i);
  const colorOf = (it: BottomNavItem, i: number): ColorToken => it.color ?? CYCLE[i % CYCLE.length]!;
  const activeIndex = (): number => items.findIndex((it) => it.id === val(props.value));
  const brand = (): boolean => (val(props.tint) ?? "brand") === "brand";
  const labels = (): boolean => val(props.labels) ?? true;
  let bubble!: HTMLElement, ring: HTMLElement | undefined, core: HTMLElement | undefined;
  const icons: HTMLElement[] = [];

  const tab = (it: BottomNavItem, i: number): Element => {
    const on = (): boolean => val(props.value) === it.id;
    const attrs = {
      class: () => cx("hm-bnav-item", on() && "is-active"),
      "data-hm-color": () => (brand() ? colorAttr(colorOf(it, i)) : null),
      "aria-current": () => (on() ? "page" : null),
      "aria-label": () => val(it.label),
      onClick: (e: MouseEvent) => {
        if (it.href && (e.metaKey || e.ctrlKey || e.shiftKey)) return;
        if (it.href && props.onChange) e.preventDefault();
        if (!on()) props.onChange?.(it.id);
      },
    };
    const body = [
      h("span", { class: "hm-bnav-icon", ref: (x: HTMLElement) => { icons[i] = x; } },
        () => icon(on() && it.activeIcon != null ? it.activeIcon : it.icon, "hm-bnav-glyph"),
        it.badge !== undefined && h(Badge, { count: it.badge, class: "hm-bnav-badge" }),
        it.dot !== undefined && (() => val(it.dot) && h(Badge, { dot: true, tone: "danger", class: "hm-bnav-dot" }))),
      () => labels() && h(OverflowText, { class: "hm-bnav-label", "aria-hidden": "true" }, () => val(it.label)),
    ];
    return it.href ? h("a", { ...attrs, href: it.href }, body) : h("button", { ...attrs, type: "button" }, body);
  };

  const ringColors = props.ring?.length ? props.ring : HADI_RING;
  const press = (): void => {
    if (core) animate(core, [{ transform: "rotate(0deg)" }, { transform: "rotate(90deg)" }, { transform: "rotate(0deg)" }], { duration: 420, easing: "easeOutBack", fill: "none" });
    const btn = ring?.parentElement;
    if (btn) animate(btn, [{ transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }], { duration: 420, fill: "none" });
    props.onCreate?.();
  };
  const createSlot = create && h("div", { class: "hm-bnav-create-slot" },
    h("button", { type: "button", class: "hm-bnav-create", "aria-label": () => val(props.createLabel) ?? t`Create`, onClick: press },
      h("span", { class: "hm-bnav-ring", "aria-hidden": "true", ref: (x: HTMLElement) => { ring = x; setStyle(x, { "--hm-bnav-ring": `conic-gradient(${[...ringColors, ringColors[0]].join(", ")})` }); } }),
      h("span", { class: "hm-bnav-core", ref: (x: HTMLElement) => { core = x; } }, props.createIcon != null ? icon(props.createIcon, "hm-bnav-glyph") : glyph(plus, "hm-svg hm-bnav-glyph"))));

  const cells: unknown[] = items.map(tab);
  if (createSlot) cells.splice(createAt, 0, createSlot);

  const root = h("nav", {
    class: () => cx("hm-bnav", `hm-bnav-${val(props.variant) ?? "floating"}`, !labels() && "hm-bnav-nolabels", val(props.class)),
    "aria-label": () => val(props.label) ?? t`Main`,
  },
  h("div", { class: "hm-bnav-bar", ref: (x: HTMLElement) => { setStyle(x, { "--hm-bnav-n": String(slots) }); } },
    h("span", {
      class: () => cx("hm-bnav-bubble", activeIndex() < 0 && "is-hidden"), "aria-hidden": "true",
      "data-hm-color": () => { const i = activeIndex(); return brand() && i >= 0 ? colorAttr(colorOf(items[i]!, i)) : null; },
      ref: (x: HTMLElement) => { bubble = x; },
    }),
    cells)) as HTMLElement;

  // the bubble moves to the active slot: inline position first, then the motion engine plays the difference (FLIP)
  let prev = -1;
  effect(() => {
    const i = activeIndex();
    untrack(() => {
      if (i < 0) { prev = -1; return; }
      const before = prev >= 0 && bubble.isConnected ? bubble.getBoundingClientRect().left : null;
      setStyle(bubble, { "--hm-bnav-i": String(slotOf(i)) });
      if (before != null && prev !== i) {
        const dx = before - bubble.getBoundingClientRect().left;
        if (dx) animate(bubble, [{ transform: `translate3d(${dx}px, 0, 0)` }, { transform: "translate3d(0, 0, 0)" }], { duration: 420, easing: "easeOutBack", fill: "none" });
        const ic = icons[i];
        if (ic) animate(ic, [{ transform: "scale(0.8)" }, { transform: "scale(1.15)" }, { transform: "scale(1)" }], { duration: 360, easing: "easeOutCubic", fill: "none" });
      }
      prev = i;
    });
  });

  // ring: a slow turn on the motion engine; decorative, so reduced motion keeps it still
  let spin: { cancel(): void } | null = null, alive = true;
  if (create) queueMicrotask(() => { if (ring && alive) spin = animate(ring, [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], { duration: 12000, iterations: Infinity, easing: "linear" }); });
  onCleanup(() => { alive = false; spin?.cancel(); });
  return root;
}
