// LikeButton (march/ui): a heart toggle with a count. Liking pops the heart on a spring, rings it and throws a
// burst of particles in the four HADİ colors (motion engine: global speed, pause and reduced motion apply; with
// reduced motion only the fill changes). heartBurst() / heartPop() (motion/burst.ts, re-exported here) are the same
// effects for any element (a double-tap on a photo, a comment, a story).
import { live } from "../../../forms/util.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, glyph, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { heart } from "../../../icons/glyphs/heart.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { Button } from "../../actions/button/index.ts";
import { heartBurst, heartPop, type BurstOptions } from "../../../motion/burst.ts";
import { CountRoll } from "../count-roll/index.ts";
import "./like-button.css";

export { heartBurst, heartPop, type BurstOptions } from "../../../motion/burst.ts";

export interface LikeButtonProps {
  /** Liked or not (live). @tr Beğenildi mi (canlı). */
  liked: MaybeFn<boolean | null | undefined>;
  /** Called with the next state; the owner updates `liked` (and the count). @tr Sonraki durumla çağrılır; `liked` değerini (ve sayıyı) sahibi günceller. */
  onToggle: (next: boolean) => void;
  /** The count next to the heart (hidden at 0); leave it out for no count. @tr Kalbin yanındaki sayı (0 iken gizlenir); sayı istemezseniz vermeyin. */
  count?: MaybeFn<number | null | undefined>;
  /** Size: sm, md (default) or lg. @tr Boyut: sm, md (varsayılan) ya da lg. */
  size?: MaybeFn<"sm" | "md" | "lg" | undefined>;
  /** Particle burst on like. Default true. @tr Beğenide parçacık patlaması. Varsayılan true. */
  burst?: MaybeFn<boolean | undefined>;
  /** brand: particles in the four HADİ colors · single: the heart color. Default brand. @tr brand: dört HADİ renginde parçacıklar · single: kalbin rengi. Varsayılan brand. */
  colors?: MaybeFn<"brand" | "single" | undefined>;
  /** Accessible name. Default "Like". @tr Erişilebilir ad. Varsayılan "Beğen". */
  label?: MaybeFn<string | undefined>;
  /** Your own icon instead of the heart: a node, or `(liked) => node`. @tr Kalp yerine kendi ikonunuz: bir düğüm ya da `(liked) => node`. */
  icon?: Node | ((liked: boolean) => unknown) | undefined;
  /** The pop of the icon on every toggle. Default true. @tr Her geçişte ikonun zıplaması. Varsayılan true. */
  pop?: MaybeFn<boolean | undefined>;
  /** Shape of the burst: `{ count, radius, ring }` (`ring: false` drops the ring). @tr Patlamanın biçimi: `{ count, radius, ring }` (`ring: false` halkayı kaldırır). */
  burstOptions?: BurstOptions | undefined;
  /** Text of the count: compact (1,2 B, default) or full (1.234). @tr Sayının metni: compact (1,2 B, varsayılan) ya da full (1.234). */
  countFormat?: MaybeFn<"compact" | "full" | undefined>;
  /** Extra class on the button. @tr Düğmeye eklenen sınıf. */
  class?: ClassProp;
}

/** `<LikeButton liked={$liked} count={$likes} onToggle={(on) => { $liked = on; $likes += on ? 1 : -1 }} />` */
export function LikeButton(props: LikeButtonProps): Element {
  let icon!: HTMLElement, hit!: HTMLElement;
  const toggle = (): void => {
    const next = !val(props.liked);
    props.onToggle(next);
    if (val(props.pop) !== false) heartPop(icon, next);
    const size = val(props.size);
    if (next && val(props.burst) !== false) heartBurst(hit, { colors: val(props.colors) ?? "brand", radius: size === "lg" ? 34 : size === "sm" ? 20 : 26, ...props.burstOptions });
  };
  const own = props.icon;
  // a ghost pill Button with a pressed state; the count rolls in its label
  return h(Button, {
    variant: "ghost", shape: "pill", pressed: () => !!val(props.liked),
    // brand pink unless m:color gives another (the common prop is applied after, on this root)
    "data-m-color": "brand-pink",
    class: () => cx("m-like", `m-like-${val(props.size) ?? "md"}`, val(props.liked) && "is-liked", val(props.class)),
    "aria-label": () => val(props.label) ?? t`Like`,
    onClick: toggle,
    icon: h("span", { class: "m-like-hit", ref: (x: HTMLElement) => { hit = x; } },
      h("span", { class: "m-like-heart", ref: (x: HTMLElement) => { icon = x; } }, typeof own === "function" ? () => own(!!val(props.liked)) : own ?? glyph(heart))),
    children: props.count !== undefined ? h(CountRoll, { value: () => val(props.count) ?? 0, hideZero: true, format: () => val(props.countFormat), class: "m-like-count" }) : null,
  }) as Element;
}
