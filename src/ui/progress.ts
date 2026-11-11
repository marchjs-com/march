// Progress (hadi-march/ui).
import "./progress.css";
import { computed, effect } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "./util.ts";
const setVar = (el: Element, name: string, value: string): void => { (el as HTMLElement).style?.setProperty(name, value); };

export interface ProgressProps {
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
  const pct = computed(() => { const v = val(props.value); return v == null ? null : Math.max(0, Math.min(100, (v / max) * 100)); });
  const fill = h("span", { class: "hm-progress2-fill" });
  const bar = h("span", {
    class: "hm-progress2-track", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(max),
    "aria-valuenow": () => { const v = val(props.value); return v == null ? null : String(v); }, "aria-label": () => val(props.label) ?? t`Progress`,
  }, fill);
  const sync = (): void => { const p = pct(); setVar(fill, "--hm-progress", p == null ? "0" : String(p / 100)); };
  const root = h("div", { class: () => cx("hm-progress2", `hm-progress2-${props.size ?? "md"}`, `hm-progress2-${val(props.tone) ?? "primary"}`, pct() == null && "is-indeterminate", val(props.class)) },
    (props.label != null || props.showValue) && h("div", { class: "hm-progress2-head" },
      h("span", { class: "hm-progress2-label" }, () => val(props.label) ?? ""),
      props.showValue && h("span", { class: "hm-progress2-value" }, () => (pct() == null ? "" : `${Math.round(pct() as number)}%`))),
    bar);
  effect(sync);
  return root;
}
