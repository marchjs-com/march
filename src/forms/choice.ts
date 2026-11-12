// Selection controls: the drawn box of Checkbox / CheckboxGroup / RadioGroup. The real <input> stays (visually hidden,
// focusable, form value, keyboard, screen readers); a decorative box next to it draws the state: a tick that strokes in
// (stroke-dashoffset), a fill that scales up, a radio dot with a spring, a dash for "indeterminate". Variants:
//   classic  polished rounded box                    soft    tinted box, colored tick
//   chip     a pill that fills when selected         card    a large card (title, description, icon) with a tick badge
//   toggle   joined buttons, the selected one filled (radio: also "segmented")
// All motion is transform / stroke; prefers-reduced-motion makes it instant. Colors come from the color token.
import "./choice.css";
import { h } from "../dom/h.ts";
import { cx, glyph } from "../ui/util.ts";
import { svgIcon, type IconDef } from "../icons/svg.ts";
import type { MaybeFn } from "../ui/util.ts";

export type ChoiceVariant = "classic" | "soft" | "chip" | "card" | "toggle" | "segmented";
export type ChoiceSize = "sm" | "md" | "lg";
export type ChoiceShape = "square" | "rounded" | "circle";

export interface ChoiceLook {
  /** Look of the control (default "classic"). */
  variant?: ChoiceVariant | undefined;
  size?: ChoiceSize | undefined;
  /** Box corners (checkboxes; radios are round). Default "rounded". */
  shape?: ChoiceShape | undefined;
  /** An icon (hadi-march/icons) shown instead of the drawn tick. */
  icon?: IconDef | undefined;
  /** false: no animation. */
  animate?: boolean | undefined;
}

const TICK: IconDef = { name: "choice-tick", d: ["M5 12.5l4.5 4.5L19 7.5"] };
const DASH: IconDef = { name: "choice-dash", d: ["M7 12h10"] };

/** Classes of the group / single control wrapper. */
export const lookClass = (l: ChoiceLook, kind: "checkbox" | "radio"): string =>
  cx("hm-choice", `hm-choice-${l.variant ?? "classic"}`, `hm-choice-${l.size ?? "md"}`, kind === "radio" ? "hm-shape-circle" : `hm-shape-${l.shape ?? "rounded"}`, l.animate === false && "hm-choice-still");

/** The decorative box drawn next to an input. */
export function choiceBox(kind: "checkbox" | "radio", l: ChoiceLook): Element {
  if (kind === "radio") return h("span", { class: "hm-check-box", "aria-hidden": "true" }, h("span", { class: "hm-radio-dot" }));
  const mark = l.icon ? glyph(l.icon, "hm-svg hm-check-icon") : svgIcon(TICK, "hm-check-mark");
  return h("span", { class: "hm-check-box", "aria-hidden": "true" }, mark, svgIcon(DASH, "hm-check-dash"));
}

/** Label part: plain text, or title + description (+ icon) in the card variant. */
export function choiceText(label: unknown, hint: unknown, icon: unknown, variant: ChoiceVariant | undefined): unknown {
  if (variant === "card") {
    return h("span", { class: "hm-check-label hm-choice-card-text" },
      icon ? h("span", { class: "hm-choice-card-icon", "aria-hidden": "true" }, typeof icon === "object" ? glyph(icon as IconDef) : icon) : null,
      h("span", { class: "hm-choice-card-title" }, label as MaybeFn<unknown>),
      hint != null ? h("span", { class: "hm-choice-card-desc" }, hint as MaybeFn<unknown>) : null);
  }
  return h("span", { class: "hm-check-label" }, label as MaybeFn<unknown>, hint != null ? h("small", { class: "hm-hint" }, hint as MaybeFn<unknown>) : null);
}

/** `colors="brand"`: the four HADİ colors in turn (orange, blue, green, purple), or a list of tokens. */
export function itemColor(colors: "brand" | readonly string[] | undefined, i: number): string | null {
  const list = colors === "brand" ? ["brand-orange", "brand-blue", "brand-green", "brand-purple"] : colors;
  return list && list.length ? (list[i % list.length] as string) : null;
}
