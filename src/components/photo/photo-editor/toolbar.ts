// The left toolbar: tools in groups (one slot per group shows its last used tool; long press, right click or the
// corner mark opens the others), foreground / background colors with swap and defaults, quick mask and screen mode.
// One Tab stop (roving), arrows move, Enter opens a group; tool switches glide an indicator on the motion engine.

import { signal, untrack, effect } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { cx, later, setStyle } from "../../../core/util.ts";
import { roving } from "../../../ui/focus.ts";
import { labelWithKey } from "../../../ui/key-label.ts";
import { play } from "../../../motion/play.ts";
import { still } from "../../../motion/engine/parts.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { PopoverPanel } from "../../overlays/popover/index.ts";
import { PlainListRow } from "../../data/list-row/core.ts";
import { Kbd } from "../../typography/kbd/index.ts";
import { Swatch } from "../../forms/swatch/index.ts";
import { getTool, type Tool } from "../../../image/doc/tools/tool.ts";
import { ICONS } from "./icons.ts";
import type { Editor } from "./editor.ts";

/** Slots of the toolbar, top to bottom; each lists its tools in flyout order (ids not registered are skipped). */
export const TOOL_SLOTS: string[][] = [
  ["move", "artboard"],
  ["marquee-rect", "marquee-ellipse", "marquee-row", "marquee-col"],
  ["lasso", "lasso-poly", "lasso-magnetic"],
  ["object-select", "quick-select", "magic-wand"],
  ["crop", "perspective-crop", "slice", "slice-select"],
  ["eyedropper", "color-sampler", "ruler", "note", "count"],
  ["spot-heal", "heal", "patch", "content-move", "red-eye"],
  ["brush", "pencil", "color-replace", "mixer-brush"],
  ["clone-stamp", "pattern-stamp"],
  ["history-brush", "art-history-brush"],
  ["eraser", "background-eraser", "magic-eraser"],
  ["gradient", "bucket"],
  ["blur", "sharpen", "smudge"],
  ["dodge", "burn", "sponge"],
  ["pen", "freeform-pen", "curvature-pen", "add-anchor", "delete-anchor", "convert-anchor"],
  ["type", "type-vertical", "type-mask", "type-vertical-mask"],
  ["path-select", "direct-select"],
  ["shape-rect", "shape-round-rect", "shape-ellipse", "shape-polygon", "shape-line", "shape-custom"],
  ["hand", "rotate-view"],
  ["zoom"],
];

export interface ToolbarProps { editor: Editor; slots?: string[][] | undefined; columns?: 1 | 2 | undefined; motion?: boolean | undefined }

const iconOf = (tool: Tool | undefined): unknown => (tool ? (ICONS as Record<string, unknown>)[tool.icon] ?? tool.icon : null);

/** The toolbar element. */
export function Toolbar(props: ToolbarProps): Element {
  const ed = props.editor;
  const openSlot = signal(-1);
  const buttons: HTMLElement[] = [];
  let ind: HTMLElement | undefined;
  const slots = (): string[][] => (props.slots ?? TOOL_SLOTS).map((s) => s.filter((id) => getTool(id))).filter((s) => s.length);
  const current = (slot: string[]): string => {
    const now = ed.tool();
    return slot.includes(now) ? now : slot.find((id) => ed.lastInGroup[getTool(id)!.group] === id) ?? slot[0]!;
  };

  // the active slot's indicator glides to it (motion engine; off with motion = false / reduced motion)
  effect(() => {
    const id = ed.tool();
    const i = slots().findIndex((s) => s.includes(id));
    const btn = buttons[i];
    if (!btn || !ind) return;
    const y = btn.offsetTop, x = btn.offsetLeft;
    const from = ind.style.transform;
    setStyle(ind, { transform: `translate(${x}px, ${y}px)`, opacity: 1 });
    if (from && !still(() => props.motion === false || !untrack(ed.prefs).motion)) play(ind, { transform: [from, `translate(${x}px, ${y}px)`] }, { duration: 220, easing: "spring" });
  });

  let press: ReturnType<typeof setTimeout> | undefined;
  const slotButton = (slot: string[], i: number): unknown => {
    let el: HTMLElement | undefined;
    const tool = (): Tool | undefined => getTool(current(slot));
    const flyout = slot.length > 1;
    const btn = h(IconButton, {
      icon: () => iconOf(tool()), size: "sm", variant: "ghost",
      class: () => cx("m-pe-tool", slot.includes(ed.tool()) && "is-active", flyout && "has-flyout"),
      label: () => { const tl = tool(); return tl ? labelWithKey(t(tl.label), tl.key ?? "") : ""; },
      tabindex: i === 0 ? "0" : "-1", "aria-pressed": () => String(slot.includes(ed.tool())),
      ...(flyout ? { "aria-haspopup": "menu", "aria-expanded": () => String(openSlot() === i) } : {}),
      ref: (x: HTMLElement) => { el = x; buttons[i] = x; },
      onClick: () => { ed.setTool(current(slot)); },
      onPointerDown: (e: PointerEvent) => { if (flyout && e.button === 0) { clearTimeout(press); press = later(() => openSlot.set(i), 380); } },
      onPointerUp: () => clearTimeout(press),
      onPointerLeave: () => clearTimeout(press),
      onContextmenu: (e: MouseEvent) => { if (flyout) { e.preventDefault(); openSlot.set(i); } },
      onKeydown: (e: KeyboardEvent) => {
        if (flyout && (e.key === "Enter" && e.altKey || e.key === "ArrowRight")) { e.preventDefault(); openSlot.set(i); return; }
        roving(e, buttons.filter(Boolean));
      },
    });
    if (!flyout) return btn;
    const menu = h(PopoverPanel, {
      anchor: () => el, open: () => openSlot() === i, onOpenChange: (v: boolean) => { if (!v) openSlot.set(-1); },
      role: "menu", placement: "right-start", flush: true, label: () => t(tool()?.label ?? ""), panelClass: "m-menu m-pe-flyout",
      children: () => slot.map((id) => {
        const tl = getTool(id)!;
        return h(PlainListRow, {
          size: "sm", role: "menuitemradio", tabindex: "-1", class: "m-menu-item", "aria-checked": () => String(ed.tool() === id),
          lead: iconOf(tl), title: t(tl.label), trail: tl.key ? h(Kbd, { keys: tl.key }) : undefined,
          onClick: () => { ed.setTool(id); openSlot.set(-1); el?.focus(); },
        });
      }),
    });
    return [btn, menu];
  };

  const colors = h("div", { class: "m-pe-colors", role: "group", "aria-label": t`Colors` },
    h(Swatch, { class: "m-pe-fg", size: "md", label: t`Foreground color`, color: () => css(ed.fg()), onClick: () => ed.shared.ui && (ed.shared.ui as (w: string, d?: unknown) => void)("picker", "fg") }),
    h(Swatch, { class: "m-pe-bg", size: "md", label: t`Background color`, color: () => css(ed.bg()), onClick: () => ed.shared.ui && (ed.shared.ui as (w: string, d?: unknown) => void)("picker", "bg") }),
    h(IconButton, { class: "m-pe-swap", icon: ICONS.swap, size: "xs", variant: "ghost", label: labelWithKey(t`Swap colors`, "x"), onClick: () => ed.swapColors() }),
    h(IconButton, { class: "m-pe-defaults", icon: ICONS.defaults, size: "xs", variant: "ghost", label: labelWithKey(t`Default colors`, "d"), onClick: () => ed.resetColors() }),
  );

  return h("div", { class: () => cx("m-pe-toolbar", props.columns === 2 && "is-two"), role: "toolbar", "aria-orientation": "vertical", "aria-label": t`Tools` },
    h("span", { class: "m-pe-tool-ind", "aria-hidden": "true", ref: (x: HTMLElement) => { ind = x; } }),
    () => { buttons.length = 0; return untrack(() => slots().map((s, i) => slotButton(s, i))); },
    h("div", { class: "m-pe-toolbar-sep", role: "separator" }),
    colors,
    h(IconButton, { icon: ICONS.quickMask, size: "sm", variant: "ghost", class: () => cx("m-pe-tool", ed.quickMask() && "is-active"), label: labelWithKey(t`Quick mask`, "q"), "aria-pressed": () => String(ed.quickMask()), onClick: () => ed.run("select.quickMask") }),
    h(IconButton, { icon: ICONS.screenMode, size: "sm", variant: "ghost", class: "m-pe-tool", label: labelWithKey(t`Screen mode`, "f"), onClick: () => ed.run("view.screen.cycle") }),
  );
}

/** CSS color of an RGBA. */
export const css = (c: readonly number[]): string => `rgb(${Math.round(c[0]! * 255)} ${Math.round(c[1]! * 255)} ${Math.round(c[2]! * 255)} / ${c[3] ?? 1})`;
