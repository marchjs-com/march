// Rating (hadi-march/ui).
import "./rating.css";
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, glyph, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { star } from "../../../icons/glyphs/star.ts";
import { starFilled } from "../../../icons/glyphs/starFilled.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { roving } from "../../../ui/focus.ts";
import type { IconDef } from "../../../icons/svg.ts";
import { isRtl } from "../../../core/util.ts";

export interface RatingProps {
  /** Theme color token (see ColorToken): "brand-blue", "success", "cat-3"… Default: the theme's primary. */
  color?: ColorToken | undefined;
  value?: MaybeFn<number | null | undefined>;
  setValue?: (v: number) => void;
  onChange?: (v: number) => void;
  max?: number;
  readonly?: boolean;
  label?: MaybeFn<string | undefined>;
  size?: "sm" | "md" | "lg";
  /** The empty mark instead of the star outline: an icon of hadi-march/icons, or `(n) => node` for your own drawing. */
  icon?: IconDef | ((n: number) => unknown) | undefined;
  /** The filled mark instead of the filled star (same forms as `icon`). */
  iconOn?: IconDef | ((n: number) => unknown) | undefined;
  /** Accessible name of a mark: `(n, max) => text` (default "3 of 5"). */
  starLabel?: ((n: number, max: number) => string) | undefined;
  /** `false`: no hover growth and no fade between empty and filled. */
  animate?: boolean | undefined;
  class?: ClassProp;
}
/** Star rating (radio group; ← → change): `<Rating bind:value={$stars} />`, `<Rating value={4.5} readonly />` */
export function Rating(props: RatingProps): Element {
  const max = props.max ?? 5;
  const hover = signal<number | null>(null);
  const shown = (): number => hover() ?? Number(val(props.value) ?? 0);
  const set = (v: number): void => { if (props.readonly) return; props.setValue?.(v); props.onChange?.(v); };
  const mark = (p: RatingProps["icon"], def: IconDef, n: number): unknown => (typeof p === "function" ? p(n) : glyph(p ?? def));
  const stars = Array.from({ length: max }, (_, i) => {
    const n = i + 1;
    const filled = (): boolean => shown() >= n - 0.25;
    return h("button", {
      type: "button", role: "radio", class: () => cx("m-rating-star", filled() && "is-on", !filled() && shown() > n - 1 && "is-half"),
      "aria-checked": () => String(Math.round(Number(val(props.value) ?? 0)) === n), "aria-label": () => props.starLabel?.(n, max) ?? t`${n} of ${max}`,
      tabindex: () => (Math.max(1, Math.round(Number(val(props.value) ?? 0))) === n ? "0" : "-1"), disabled: () => !!props.readonly,
      onClick: () => set(n), onMouseenter: () => !props.readonly && hover.set(n),
    }, h("span", { class: "m-rating-off" }, mark(props.icon, star, n)), h("span", { class: "m-rating-on" }, mark(props.iconOn ?? props.icon, starFilled, n)));
  });
  return h("span", { "data-m-color": () => colorAttr(props.color),
    class: () => cx("m-rating", `m-rating-${props.size ?? "md"}`, props.readonly && "is-readonly", props.animate === false && "is-still", hover() != null && "is-hovering", val(props.class)), role: "radiogroup",
    "aria-label": () => val(props.label) ?? t`Rating`, onMouseleave: () => hover.set(null),
    // radio group keys: arrows (RTL mirrored), Home / End, no wrap; the value follows focus
    onKeydown: (e: KeyboardEvent) => {
      if (props.readonly) return;
      const g = e.currentTarget as HTMLElement, stars = [...g.querySelectorAll<HTMLElement>(".m-rating-star")];
      const to = roving(e, stars, { horizontal: e.key === "ArrowLeft" || e.key === "ArrowRight", wrap: false, rtl: isRtl(g) });
      if (to) set(stars.indexOf(to) + 1);
    },
  }, stars);
}
