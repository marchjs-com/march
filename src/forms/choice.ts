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

/** Default corner shape per variant: chips are pills, everything else rounded. */
const defaultShape = (v: ChoiceVariant | undefined): ChoiceShape => (v === "chip" ? "circle" : "rounded");

/**
 * Classes of the group / single control wrapper. `size` changes every variant (box, padding, type size); `shape` changes
 * the box (classic, soft checkboxes), the pill (chip), the buttons (toggle, segmented) and the card corners (square or
 * rounded; a card is never round). Radio boxes are always round.
 */
export const lookClass = (l: ChoiceLook, kind: "checkbox" | "radio"): string =>
  cx("hm-choice", `hm-choice-${l.variant ?? "classic"}`, `hm-choice-${l.size ?? "md"}`, `hm-shape-${l.shape ?? defaultShape(l.variant)}`, kind === "radio" && "hm-choice-radio", l.animate === false && "hm-choice-still");

/** Which shapes have a visible effect for a variant / kind (pickers disable the others). */
export function shapesFor(variant: ChoiceVariant | undefined, kind: "checkbox" | "radio"): ChoiceShape[] {
  if (variant === "card") return ["square", "rounded"];
  if (kind === "radio" && (variant ?? "classic") !== "chip" && variant !== "toggle" && variant !== "segmented") return [];
  return ["square", "rounded", "circle"];
}

/** The decorative box drawn next to an input. */
export function choiceBox(kind: "checkbox" | "radio", l: ChoiceLook): Element {
  // a card shows a tick badge for radios too (no dot)
  if (kind === "radio" && l.variant !== "card") return h("span", { class: "hm-check-box", "aria-hidden": "true" }, h("span", { class: "hm-radio-dot" }));
  const mark = l.icon ? glyph(l.icon, "hm-svg hm-check-icon") : svgIcon(TICK, "hm-check-mark");
  return h("span", { class: "hm-check-box", "aria-hidden": "true" }, mark, svgIcon(DASH, "hm-check-dash"));
}

/** Label part: plain text, or title + description (+ icon) in the card variant. */
export function choiceText(label: unknown, hint: unknown, icon: unknown, variant: ChoiceVariant | undefined, meta?: unknown): unknown {
  if (variant === "card") {
    // icon | title + description | meta (a price or a badge)
    return h("span", { class: "hm-check-label hm-choice-card-body" },
      icon ? h("span", { class: "hm-choice-card-icon", "aria-hidden": "true" }, typeof icon === "object" && !(icon as Partial<Node>).nodeType && !Array.isArray(icon) ? glyph(icon as IconDef) : icon) : null,
      h("span", { class: "hm-choice-card-text" },
        h("span", { class: "hm-choice-card-title" }, label as MaybeFn<unknown>),
        hint != null ? h("span", { class: "hm-choice-card-desc" }, hint as MaybeFn<unknown>) : null),
      meta != null ? h("span", { class: "hm-choice-card-meta" }, meta as MaybeFn<unknown>) : null);
  }
  return h("span", { class: "hm-check-label" }, label as MaybeFn<unknown>, hint != null ? h("small", { class: "hm-hint" }, hint as MaybeFn<unknown>) : null);
}

/** `colors="brand"`: the four HADİ colors in turn (orange, blue, green, purple), or a list of tokens. */
export function itemColor(colors: "brand" | readonly string[] | undefined, i: number): string | null {
  const list = colors === "brand" ? ["brand-orange", "brand-blue", "brand-green", "brand-purple"] : colors;
  return list && list.length ? (list[i % list.length] as string) : null;
}
