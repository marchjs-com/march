// Skeleton (hadi-march/feedback): placeholder lines or a block shaped like the content that is on its way.
import "./skeleton.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, type ClassProp } from "../../../ui/util.ts";

export interface SkeletonProps {
  lines?: number; block?: boolean; height?: "sm" | "md" | "lg"; class?: ClassProp; /** "single": a neutral shimmer even in a multicolor theme. */ colors?: "single" | "brand" | undefined;
  /** The moving shimmer (default true); false keeps the shapes still. */
  shimmer?: boolean | undefined;
  /** The last of several lines is shorter (default true). */
  shortLast?: boolean | undefined;
  /** Accessible name of the lines (default "Loading", translated). */
  label?: string | undefined;
}
/** Placeholder while loading: `<Skeleton lines={3} />`, `<Skeleton block height="lg" />`. */
export function Skeleton(props: SkeletonProps): Element {
  const tint = cx(props.colors === "single" ? "hm-skel-single" : props.colors === "brand" ? "hm-skel-brand" : null, props.shimmer === false && "is-still");
  if (props.block) return h("div", { class: () => cx("hm-skel", "hm-skel-block", `hm-skel-${props.height ?? "md"}`, tint, val(props.class)), "aria-hidden": "true" });
  const n = props.lines ?? 3;
  return h("div", { class: () => cx("hm-skel-lines", tint, val(props.class)), "aria-busy": "true", "aria-label": () => props.label ?? t`Loading` },
    Array.from({ length: n }, (_, i) => h("span", { class: cx("hm-skel", "hm-skel-line", i === n - 1 && n > 1 && props.shortLast !== false && "hm-skel-short") })));
}
