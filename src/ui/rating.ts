// Rating (hadi-march/ui).
import "./rating.css";
import { signal } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { val, cx, glyph, type MaybeFn, type ClassProp } from "./util.ts";
import { star } from "../icons/glyphs/star.ts";
import { starFilled } from "../icons/glyphs/starFilled.ts";

export interface RatingProps {
  value?: MaybeFn<number | null | undefined>;
  setValue?: (v: number) => void;
  onChange?: (v: number) => void;
  max?: number;
  readonly?: boolean;
  label?: MaybeFn<string | undefined>;
  size?: "sm" | "md" | "lg";
  class?: ClassProp;
}
/** Star rating (radio group; ← → change): `<Rating bind:value={$stars} />`, `<Rating value={4.5} readonly />` */
export function Rating(props: RatingProps): Element {
  const max = props.max ?? 5;
  const hover = signal<number | null>(null);
  const shown = (): number => hover() ?? Number(val(props.value) ?? 0);
  const set = (v: number): void => { if (props.readonly) return; props.setValue?.(v); props.onChange?.(v); };
  const stars = Array.from({ length: max }, (_, i) => {
    const n = i + 1;
    const filled = (): boolean => shown() >= n - 0.25;
    return h("button", {
      type: "button", role: "radio", class: () => cx("hm-rating-star", filled() && "is-on", !filled() && shown() > n - 1 && "is-half"),
      "aria-checked": () => String(Math.round(Number(val(props.value) ?? 0)) === n), "aria-label": () => t`${n} of ${max}`,
      tabindex: () => (Math.max(1, Math.round(Number(val(props.value) ?? 0))) === n ? "0" : "-1"), disabled: props.readonly,
      onClick: () => set(n), onMouseenter: () => !props.readonly && hover.set(n),
      onKeydown: (e: KeyboardEvent) => {
        const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const next = Math.max(1, Math.min(max, n + d));
        set(next);
        ((e.currentTarget as HTMLElement).parentElement?.children[next - 1] as HTMLElement | undefined)?.focus();
      },
    }, h("span", { class: "hm-rating-off" }, glyph(star)), h("span", { class: "hm-rating-on" }, glyph(starFilled)));
  });
  return h("span", {
    class: () => cx("hm-rating", `hm-rating-${props.size ?? "md"}`, props.readonly && "is-readonly", val(props.class)), role: "radiogroup",
    "aria-label": () => val(props.label) ?? t`Rating`, onMouseleave: () => hover.set(null),
  }, stars);
}
