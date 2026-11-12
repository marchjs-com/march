// Progress (hadi-march/ui).
import "./progress.css";
import { computed, effect } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "./util.ts";
import { colorAttr, colorList, paintOf, type ColorToken, type MultiColors } from "../theme/colors.ts";
import { clamp } from "../core/util.ts";
const setVar = (el: Element, name: string, value: string): void => { (el as HTMLElement).style?.setProperty(name, value); };

export interface ProgressProps {
  /** Theme color token (see ColorToken): "brand-blue", "success", "cat-3"… Default: the theme's primary. */
  color?: ColorToken | undefined;
  /**
   * Several colors: "brand" (the four HADİ colors, the HADİ theme's default), a list of color tokens, or "single" (one
   * color even in a multicolor theme).
   */
  colors?: MultiColors | undefined;
  /** How several colors are laid out: "gradient" (default), "segments" (equal parts) or "cycle" (colors flow). */
  paint?: "gradient" | "segments" | "cycle" | undefined;
  /** 0..max; omit (or null) for an indeterminate bar. */
  value?: MaybeFn<number | null | undefined>;
  max?: number;
  tone?: MaybeFn<"primary" | "success" | "warn" | "danger" | "info" | undefined>;
  label?: MaybeFn<string | undefined>;
  /** Show the percentage next to the label. */
  showValue?: boolean;
  size?: "sm" | "md" | "lg";
  class?: ClassProp;
}
/** `<Progress value={$p} label="Uploading" showValue />`, `<Progress />` (indeterminate). */
export function Progress(props: ProgressProps): Element {
  const max = props.max ?? 100;
  const pct = computed(() => { const v = val(props.value); return v == null ? null : clamp((v / max) * 100, 0, 100); });
  const fill = h("span", { class: "hm-progress2-fill" });
  const bar = h("span", {
    class: "hm-progress2-track", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(max),
    "aria-valuenow": () => { const v = val(props.value); return v == null ? null : String(v); }, "aria-label": () => val(props.label) ?? t`Progress`,
  }, fill);
  const sync = (): void => { const p = pct(); setVar(fill, "--hm-progress", p == null ? "0" : String(p / 100)); };
  const root = h("div", { "data-hm-color": colorAttr(props.color), class: () => cx("hm-progress2", `hm-progress2-${props.size ?? "md"}`, `hm-progress2-${val(props.tone) ?? "primary"}`, pct() == null && "is-indeterminate", props.colors === "single" && "hm-paint-single", props.paint === "cycle" && "hm-paint-cycle", val(props.class)) },
    (props.label != null || props.showValue) && h("div", { class: "hm-progress2-head" },
      h("span", { class: "hm-progress2-label" }, () => val(props.label) ?? ""),
      props.showValue && h("span", { class: "hm-progress2-value" }, () => (pct() == null ? "" : `${Math.round(pct() as number)}%`))),
    bar);
  effect(sync);
  const list = colorList(props.colors);
  if (list) root.setAttribute("data-hm-colors", Array.isArray(props.colors) ? "custom" : String(props.colors));
  if (list && props.paint === "cycle") setVar(root, "--hm-progress-cycle", paintOf(list, "gradient", "linear", true));
  else if (list) setVar(root, "--hm-progress-c", paintOf(list, props.paint === "segments" ? "segments" : "gradient", "linear"));
  return root;
}
