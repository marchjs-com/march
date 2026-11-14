// OverflowToolbar (hadi-march/ui): a toolbar whose items that do not fit go to a "More" menu, lowest priority first.
// Items are plain actions or command ids (the Command manager: label, icon, shortcut, availability and busy state come
// from the command, so the palette, menus and this toolbar show the same thing). Toggle items (aria-pressed),
// separators, roving focus with the arrow keys (mirrored in RTL), tooltips with the shortcut.
import "./overflow-toolbar.css";
import { computed, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { val, cx, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { Menu, Tooltip, type MenuItem } from "../../../ui/menu.ts";
import { Button } from "../button/index.ts";
import { IconButton } from "../icon-button/index.ts";
import { Divider } from "../../layout/stack/index.ts";
import { labelWithKey } from "../../../ui/keys.ts";
import { rovingFocus } from "../../../behaviors/roving-focus/index.ts";
import { overflowFit } from "../../../ui/fit.ts";
import { commandBinding, type CommandBinding } from "../../../managers/command/ui.ts";
import { animate } from "../../../motion/animate.ts";
import { still, motionPreset } from "../../../motion/engine/parts.ts";
import { more } from "../../../icons/glyphs/more.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

messages("tr", { "More": "Daha fazla", "More actions": "Diğer eylemler" });

export interface ToolbarItem {
  id: string;
  label?: MaybeFn<string>;
  icon?: unknown;
  onSelect?: () => unknown;
  /** A command id (Command manager): label, icon, shortcut, disabled and run come from it unless given here. */
  command?: string;
  /** A toggle button (aria-pressed). */
  pressed?: MaybeFn<boolean | undefined>;
  disabled?: MaybeFn<boolean | undefined>;
  shortcut?: string;
  /** Higher stays longer when space runs out (default 0). */
  priority?: number;
  /** Show the label next to the icon (icon-only by default when there is an icon). */
  showLabel?: boolean;
  danger?: boolean;
  /** A divider (other fields are ignored). */
  separator?: boolean;
}

export interface OverflowToolbarProps {
  items: MaybeFn<readonly ToolbarItem[]>;
  /** Accessible name. */
  label: MaybeFn<string>;
  size?: "sm" | "md";
  /** Content after the items that never overflows (a search field, a status). */
  end?: unknown;
  /** Accessible name of the More button and its menu (default: "More actions", translated). */
  moreLabel?: MaybeFn<string | undefined>;
  /** Icon of the More button (default: three dots): your own node / icon. */
  moreIcon?: unknown;
  /** Tooltips of icon-only buttons (default true); false: none (the buttons keep their accessible names). */
  tooltips?: boolean | undefined;
  /** How an item comes back from the More menu: "pop" (default), "fade", "none" / false, or `(el) => …` (your own animation). */
  motion?: "pop" | "fade" | "none" | false | ((el: Element) => unknown) | undefined;
  /** Theme color token of pressed toggles and the focus ring (default: the theme's primary). */
  color?: ColorToken | undefined;
  class?: ClassProp;
}

/** `<OverflowToolbar label="Editor" items={[{ id: "save", command: "doc.save", priority: 10 }, { id: "s", separator: true }, …]} />` */
export function OverflowToolbar(props: OverflowToolbarProps): Element {
  const list = computed(() => val(props.items) ?? []);
  let row: HTMLElement | undefined, moreEl: HTMLElement | undefined;

  // one binding per item (command or plain); a hidden command (no permission) is left out everywhere
  const bound = computed(() => list().map((it) => ({ it, b: it.separator ? null : commandBinding(it) })));
  const present = computed(() => bound().filter((x) => !x.b?.hidden()));

  const gap = (): number => (row ? parseFloat(globalThis.getComputedStyle?.(row).columnGap ?? "0") || 0 : 0);
  const fit = overflowFit({
    items: present,
    measure: () => (row ? [...row.children].map((c) => ((c as HTMLElement).offsetWidth || 0) + gap()) : null),
    priority: (i) => { const items = untrack(present); return (items[i]!.it.separator ? items[i - 1]?.it.priority : items[i]!.it.priority) ?? 0; },
    reserve: () => (moreEl?.offsetWidth || 32) + gap(),
    room: (w) => w + (moreEl && !moreEl.hidden ? moreEl.offsetWidth + 2 : 0),
    // a separator next to a hidden item (or at an edge) is not useful
    adjust: (next) => { const items = untrack(present); next.forEach((v, i) => { if (v && items[i]!.it.separator && (!next[i - 1] || !next.slice(i + 1).some(Boolean))) next[i] = false; }); },
    // items coming back slide in (motion engine), or the way `motion` says
    onChange: (next, before) => {
      const enter = props.motion ?? "pop";
      if (!still(enter)) queueMicrotask(() => next.forEach((v, i) => {
        const el = v && before[i] === false ? row?.children[i] : null;
        if (!el) return;
        if (typeof enter === "function") enter(el);
        else animate(el, motionPreset(enter === "fade" ? "fade" : "pop"), { duration: 180, easing: "easeOutCubic" });
      }));
    },
  });
  const { shown, isShown } = fit;

  const SEL = ".hm-otb-btn, .hm-otb-more > button";
  const button = (it: ToolbarItem, b: CommandBinding): unknown => {
    const tip = (): string => labelWithKey(b.label(), b.shortcut());
    const iconOnly = !!b.icon() && !it.showLabel;
    const shared = {
      class: () => cx("hm-otb-btn", iconOnly && "is-icon", it.danger && "is-danger", b.busy() && "is-busy"),
      tabindex: "-1", ...(it.pressed !== undefined ? { pressed: () => !!val(it.pressed) } : null),
      "aria-keyshortcuts": () => b.shortcut() ?? null, disabled: () => b.disabled(), onClick: () => b.run(),
      icon: () => icon(b.icon(), "hm-otb-icon"),
    };
    const btn = iconOnly ? h(IconButton, { ...shared, size: props.size === "md" ? "md" : "sm", label: tip, title: false })
      : h(Button, { ...shared, variant: "ghost", size: props.size === "md" ? "md" : "sm" }, () => b.label());
    return iconOnly && props.tooltips !== false ? h(Tooltip, { text: tip, placement: "bottom", children: btn }) : btn;
  };
  const items = (): unknown => present().map((x, i) => untrack(() => h("div", { class: "hm-otb-item", hidden: () => !isShown(i) },
    x.it.separator ? h(Divider, { vertical: true, class: "hm-otb-sep" }) : button(x.it, x.b!))));
  const overflow = computed((): MenuItem[] => present().flatMap((x, i): MenuItem[] => {
    if (isShown(i)) return [];
    if (x.it.separator) return ["-"];
    const b = x.b!;
    const sc = b.shortcut();
    return [{ label: () => b.label(), icon: b.icon(), onSelect: () => b.run(), disabled: () => b.disabled(), ...(sc ? { shortcut: sc } : {}), ...(x.it.danger ? { danger: true } : {}) }];
  }).filter((m, i, a) => m !== "-" || (i > 0 && i < a.length - 1 && a[i - 1] !== "-")));

  const buttons = (): HTMLElement[] => {
    const root = row?.parentElement;
    return root ? [...root.querySelectorAll<HTMLElement>(SEL)].filter((b) => !b.closest("[hidden]") && !(b as HTMLButtonElement).disabled) : [];
  };
  // one tab stop: the first enabled button (the roving-focus behavior moves it with the arrow keys and on focus)
  effect(() => { shown(); present(); queueMicrotask(() => { const bs = buttons(); if (bs.length && !bs.some((b) => b.tabIndex === 0)) bs[0]!.tabIndex = 0; }); });

  return h("div", { class: () => cx("hm-otb", props.size === "md" ? "hm-otb-md" : "hm-otb-sm", val(props.class)), role: "toolbar", "aria-label": () => val(props.label), "data-hm-color": () => colorAttr(props.color),
    ref: (x: HTMLElement) => { onCleanup(rovingFocus(x, { orientation: "horizontal", selector: SEL })); } },
    h("div", { class: "hm-otb-items", ref: (x: HTMLElement) => { row = x; fit.observe(x); } }, items),
    h("div", { class: "hm-otb-more", hidden: () => overflow().length === 0, ref: (x: HTMLElement) => { moreEl = x; } },
      h(Menu, { label: () => val(props.moreLabel) ?? t`More actions`, icon: ownIcon(props.moreIcon === false ? undefined : props.moreIcon ?? undefined, more), items: () => overflow(), size: "sm", variant: "ghost", placement: "bottom-end" })),
    props.end != null && h("div", { class: "hm-otb-end" }, props.end));
}
