// Skeleton (hadi-march/feedback): placeholder lines or a block shaped like the content that is on its way.
import "./skeleton.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { cx } from "../../../ui/util.ts";

export interface SkeletonProps { lines?: number; block?: boolean; height?: "sm" | "md" | "lg"; class?: string; /** "single": a neutral shimmer even in a multicolor theme. */ colors?: "single" | "brand" | undefined }
/** Placeholder while loading: `<Skeleton lines={3} />`, `<Skeleton block height="lg" />`. */
export function Skeleton(props: SkeletonProps): Element {
  const tint = props.colors === "single" ? "hm-skel-single" : props.colors === "brand" ? "hm-skel-brand" : null;
  if (props.block) return h("div", { class: cx("hm-skel", "hm-skel-block", `hm-skel-${props.height ?? "md"}`, tint, props.class), "aria-hidden": "true" });
  const n = props.lines ?? 3;
  return h("div", { class: cx("hm-skel-lines", tint, props.class), "aria-busy": "true", "aria-label": t`Loading` },
    Array.from({ length: n }, (_, i) => h("span", { class: cx("hm-skel", "hm-skel-line", i === n - 1 && n > 1 && "hm-skel-short") })));
}
