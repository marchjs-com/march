// Rating (march/ui).
import "./rating.css";
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, glyph, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { star } from "../../../icons/glyphs/star.ts";
import { starFilled } from "../../../icons/glyphs/starFilled.ts";
import { type ColorToken } from "../../../theme/colors.ts";
import { roving } from "../../../ui/focus.ts";
import type { IconDef } from "../../../icons/svg.ts";
import { isRtl, type Handler } from "../../../core/util.ts";

export interface RatingProps {
  /** The rating, a value or an accessor; a fraction fills that part of a mark (4.5: half of the fifth, 4.3: under a third), so a value glided from 0 fills the stars smoothly. @tr Puan, değer ya da erişimci; kesirli kısım bir işaretin o kadarını doldurur (4.5: beşincinin yarısı, 4.3: üçte birinden azı), böylece 0'dan kaydırılan bir değer yıldızları akıcı doldurur. */
  value?: MaybeFn<number | null | undefined>;
  /** Writes the picked rating back (set by `bind:value`). @tr Seçilen puanı geri yazar (`bind:value` bunu verir). */
  setValue?: (v: number) => void;
  /** Called with the picked rating. @tr Seçilen puanla çağrılır. */
  onChange?: Handler<[v: number]> | undefined;
  /** Number of marks (default 5). @tr İşaret sayısı (varsayılan 5). */
  max?: number;
  /** Shows the rating without letting it change. @tr Puanı değiştirilemez şekilde gösterir. */
  readonly?: boolean;
  /** Accessible name of the group (default "Rating"). @tr Grubun erişilebilir adı (varsayılan "Rating"). */
  label?: MaybeFn<string | undefined>;
  /** Mark size: `sm`, `md` (default) or `lg`. @tr İşaret boyutu: `sm`, `md` (varsayılan) ya da `lg`. */
  size?: "sm" | "md" | "lg";
  /** The empty mark instead of the star outline: an icon of march/icons, or `(n) => node` for your own drawing. @tr Yıldız çerçevesi yerine boş işaret: march/icons'tan bir ikon ya da kendi çiziminiz için `(n) => node`. */
  icon?: IconDef | ((n: number) => unknown) | undefined;
  /** The filled mark instead of the filled star (same forms as `icon`). @tr Dolu yıldız yerine dolu işaret (`icon` ile aynı biçimler). */
  iconOn?: IconDef | ((n: number) => unknown) | undefined;
  /** Accessible name of a mark: `(n, max) => text` (default "3 of 5"). @tr Bir işaretin erişilebilir adı: `(n, max) => text` (varsayılan "3 of 5"). */
  starLabel?: ((n: number, max: number) => string) | undefined;
  /** `false`: no hover growth and no fade between empty and filled. @tr `false`: üzerine gelince büyüme ve boş ile dolu arasında geçiş yok. */
  animate?: boolean | undefined;
  /** Extra CSS classes on the root element. @tr Kök öğeye eklenen CSS sınıfları. */
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
      // the filled part of a partly filled mark (rating.css clips the filled star to it)
      style: () => { const part = shown() - (n - 1); return { "--m-rating-part": !filled() && part > 0 ? part.toFixed(3) : null }; },
      "aria-checked": () => String(Math.round(Number(val(props.value) ?? 0)) === n), "aria-label": () => props.starLabel?.(n, max) ?? t`${n} of ${max}`,
      tabindex: () => (Math.max(1, Math.round(Number(val(props.value) ?? 0))) === n ? "0" : "-1"), disabled: () => !!props.readonly,
      onClick: () => set(n), onPointerEnter: () => !props.readonly && hover.set(n),
    }, h("span", { class: "m-rating-off" }, mark(props.icon, star, n)), h("span", { class: "m-rating-on" }, mark(props.iconOn ?? props.icon, starFilled, n)));
  });
  return h("span", { class: () => cx("m-rating", `m-rating-${props.size ?? "md"}`, props.readonly && "is-readonly", props.animate === false && "is-still", hover() != null && "is-hovering", val(props.class)), role: "radiogroup",
    "aria-label": () => val(props.label) ?? t`Rating`, onPointerLeave: () => hover.set(null),
    // radio group keys: arrows (RTL mirrored), Home / End, no wrap; the value follows focus
    onKeyDown: (e: KeyboardEvent) => {
      if (props.readonly) return;
      const g = e.currentTarget as HTMLElement, stars = [...g.querySelectorAll<HTMLElement>(".m-rating-star")];
      const to = roving(e, stars, { horizontal: e.key === "ArrowLeft" || e.key === "ArrowRight", wrap: false, rtl: isRtl(g) });
      if (to) set(stars.indexOf(to) + 1);
    },
  }, stars);
}
