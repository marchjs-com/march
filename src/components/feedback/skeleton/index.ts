// Skeleton (hadi-march/feedback): placeholder lines or a block shaped like the content that is on its way.
import "./skeleton.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, type ClassProp } from "../../../ui/util.ts";

export interface SkeletonProps {
  lines?: number; block?: boolean; height?: "sm" | "md" | "lg";
  /** "circle": one round shape (an avatar on its way); `height` picks its size (sm 2rem, md 2.5rem, lg 3.5rem). */
  shape?: "circle" | undefined; class?: ClassProp; /** "single": a neutral shimmer even in a multicolor theme. */ colors?: "single" | "brand" | undefined;
  /** The moving shimmer (default true); false keeps the shapes still. */
  shimmer?: boolean | undefined;
  /** The last of several lines is shorter (default true). */
  shortLast?: boolean | undefined;
  /** Accessible name of the lines (default "Loading", translated). */
  label?: string | undefined;
}
/** Placeholder while loading: `<Skeleton lines={3} />`, `<Skeleton block height="lg" />`, `<Skeleton shape="circle" />`. */
export function Skeleton(props: SkeletonProps): Element {
  const tint = cx(props.colors === "single" ? "m-skel-single" : props.colors === "brand" ? "m-skel-brand" : null, props.shimmer === false && "is-still");
  if (props.shape === "circle") return h("div", { class: () => cx("m-skel", "m-skel-circle", props.height && props.height !== "md" && `m-skel-circle-${props.height}`, tint, val(props.class)), "aria-hidden": "true" });
  if (props.block) return h("div", { class: () => cx("m-skel", "m-skel-block", `m-skel-${props.height ?? "md"}`, tint, val(props.class)), "aria-hidden": "true" });
  const n = props.lines ?? 3;
  return h("div", { class: () => cx("m-skel-lines", tint, val(props.class)), "aria-busy": "true", "aria-label": () => props.label ?? t`Loading` },
    Array.from({ length: n }, (_, i) => h("span", { class: cx("m-skel", "m-skel-line", i === n - 1 && n > 1 && props.shortLast !== false && "m-skel-short") })));
}
