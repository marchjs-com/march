// Skeleton (hadi-march/feedback): placeholder lines or a block shaped like the content that is on its way.
import "./skeleton.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, type ClassProp } from "../../../ui/util.ts";

export interface SkeletonProps {
  /** Number of text lines (default 3). @tr Metin satırı sayısı (varsayılan 3). */
  lines?: number;
  /** One block instead of lines (default false). @tr Satırlar yerine tek blok (varsayılan false). */
  block?: boolean;
  /** Height of the block, or the size of the circle: sm, md (default) or lg. @tr Bloğun yüksekliği ya da dairenin boyutu: sm, md (varsayılan) ya da lg. */
  height?: "sm" | "md" | "lg";
  /** "circle": one round shape (an avatar on its way); `height` picks its size (sm 2rem, md 2.5rem, lg 3.5rem). @tr "circle": tek yuvarlak şekil (yolda olan bir avatar); boyutunu `height` seçer (sm 2rem, md 2.5rem, lg 3.5rem). */
  shape?: "circle" | undefined;
  /** Extra classes on the skeleton. @tr İskelete eklenen sınıflar. */
  class?: ClassProp;
  /** "single": a neutral shimmer even in a multicolor theme; "brand": a four-colour shimmer. @tr "single": çok renkli temada bile nötr parıltı; "brand": dört renkli parıltı. */
  colors?: "single" | "brand" | undefined;
  /** The moving shimmer (default true); false keeps the shapes still. @tr Hareketli parıltı (varsayılan true); false şekilleri durgun bırakır. */
  shimmer?: boolean | undefined;
  /** The last of several lines is shorter (default true). @tr Birden çok satırın sonuncusu daha kısa (varsayılan true). */
  shortLast?: boolean | undefined;
  /** Accessible name of the lines (default "Loading", translated). @tr Satırların erişilebilir adı (varsayılan "Loading", çevrilir). */
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
