// Badge and count labels (march/ui). Folder: src/components/data/badge/.
import "./badge.css";
import { h } from "../../../dom/h.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import type { Tone } from "../../../ui/display-base.ts";
import { type ColorToken, withColor } from "../../../theme/colors.ts";
import { StatusDot } from "../../feedback/status-dot/index.ts";

/** Format a count for badges: 120 → "99+". */
export const countLabel = (n: number, max = 99): string => (n > max ? `${max}+` : String(n));

export interface BadgeProps {
  /** Colour tone: neutral (default; danger for a count), info, success, warn or danger. @tr Renk tonu: neutral (varsayılan; sayaçta danger), info, success, warn ya da danger. */
  tone?: MaybeFn<Tone | undefined>;
  /** "soft" (default: a tinted fill) or "solid": the tone's full colour with the text on it (a count that must stand out). @tr "soft" (varsayılan: renkli hafif dolgu) ya da "solid": tonun tam rengi, metin üstünde (öne çıkması gereken sayaç). */
  variant?: "soft" | "solid" | undefined;
  /** "md" (default) or "xs": the mini badge on the corner of an icon button, a tab, a rail item. @tr "md" (varsayılan) ya da "xs": ikon düğmesinin, sekmenin, ray ögesinin köşesindeki mini rozet. */
  size?: "xs" | "md" | undefined;
  /** Count badge: hidden at 0 unless `showZero`; above `max` shows "99+". @tr Sayaç rozeti: `showZero` yoksa 0'da gizlenir; `max` aşılınca "99+" gösterir. */
  count?: MaybeFn<number | null | undefined>;
  /** Count badges: the largest number shown before "N+" (default 99). @tr Sayaç rozeti: "N+" yazmadan önce gösterilen en büyük sayı (varsayılan 99). */
  max?: number;
  /** Count badges: stay visible at 0. @tr Sayaç rozeti: 0 olduğunda da görünür kalır. */
  showZero?: boolean;
  /** Count badges: accessible label after the number ("3 unread"). @tr Sayaç rozeti: sayıdan sonra gelen erişilebilir etiket ("3 okunmamış"). */
  label?: MaybeFn<string>;
  /** Dot before the text: `true` draws the built-in dot (a StatusDot), a node is your own mark. @tr Metnin önünde nokta: `true` hazır noktayı (bir StatusDot) çizer, bir düğüm kendi işaretinizdir. */
  dot?: boolean | Node | undefined;
  /** Colour of the built-in dot (default: the text colour of the tone). @tr Hazır noktanın rengi (varsayılan: tonun metin rengi). */
  dotColor?: ColorToken | undefined;
  /** The built-in dot pulses: `true` / "ring" (a breathing ring) or "blink"; it draws the dot by itself. @tr Hazır nokta atar: `true` / "ring" (nefes alan halka) ya da "blink"; noktayı kendisi çizer. */
  pulse?: boolean | "ring" | "blink" | undefined;
  /** Count badges: your own text for the number (default `countLabel`: 120 → "99+"). @tr Sayaç rozeti: sayı için kendi metniniz (varsayılan `countLabel`: 120 → "99+"). */
  format?: ((n: number, max: number) => unknown) | undefined;
  /** A badge that can be pressed: it is drawn as a `<button>` (keyboard, focus ring, hover). @tr Basılabilen rozet: `<button>` olarak çizilir (klavye, odak halkası, üzerine gelme). */
  onClick?: ((e: MouseEvent) => void) | undefined;
  /** Clickable badge: a toggle (`aria-pressed` and the pressed look). @tr Tıklanabilir rozet: aç/kapa düğmesi (`aria-pressed` ve basılı görünüm). */
  pressed?: MaybeFn<boolean | null | undefined>;
  /** Clickable badge: cannot be pressed. @tr Tıklanabilir rozet: basılamaz. */
  disabled?: MaybeFn<boolean | null | undefined>;
  /** Accessible name when the text alone does not say it (a clickable badge with a short code). @tr Metin tek başına anlatmadığında erişilebilir ad (kısa kodlu tıklanabilir rozet). */
  ariaLabel?: MaybeFn<string | undefined>;
  /** Extra CSS classes on the badge. @tr Rozete eklenen CSS sınıfları. */
  class?: ClassProp;
  /** The badge text or content (not used for count badges). @tr Rozetin metni ya da içeriği (sayaç rozetinde kullanılmaz). */
  children?: unknown;
}
/**
 * `<Badge tone="success">Active</Badge>`, `<Badge count={n} />` (hidden at 0 unless showZero; 120 → "99+"),
 * `<Badge tone="primary" variant="solid" count={n} />` (a filled count), `<Badge pulse>Live</Badge>`, `<Badge size="xs" count={n} />`, `<Badge onClick={open}>v2</Badge>` (a button).
 */
export function Badge(props: BadgeProps): unknown {
  // a clickable badge is a button; the look is the same element with one more class
  const click = props.onClick;
  const pressed = (): boolean | null => { const p = val(props.pressed); return p == null ? null : !!p; };
  const tag = click ? "button" : "span";
  const own = click ? { type: "button", onClick: click, disabled: () => !!val(props.disabled), "aria-pressed": () => { const p = pressed(); return p == null ? null : String(p); } } : {};
  const extra = (): string => cx(props.size === "xs" && "m-badge-xs", props.variant === "solid" && "m-badge-solid", click && "m-badge-btn", click && pressed() && "is-pressed", val(props.class));
  if (props.count !== undefined) {
    return () => {
      const n = Number(val(props.count)) || 0;
      if (!n && !props.showZero) return null;
      return h(tag, { ...own, class: () => cx("m-badge", "m-badge-count", `m-badge-${val(props.tone) ?? "danger"}`, extra()), "aria-label": val(props.ariaLabel) ?? (props.label ? `${n} ${val(props.label)}` : null) }, props.format ? props.format(n, props.max ?? 99) : countLabel(n, props.max ?? 99));
    };
  }
  // the dot: the built-in one (a StatusDot in the text colour or `dotColor`, still or pulsing) or the caller's node
  const node = props.dot && props.dot !== true, pulse = !node && props.pulse ? props.pulse : false, builtIn = props.dot === true || !!pulse, mark = builtIn && !pulse && !!props.dotColor;
  return h(tag, { ...own, "aria-label": () => val(props.ariaLabel) ?? null, class: () => cx("m-badge", `m-badge-${val(props.tone) ?? "neutral"}`, builtIn && !mark && !pulse && "m-badge-dot", extra()) },
    node ? h("span", { class: "m-badge-dot-own", "aria-hidden": "true" }, props.dot)
      : builtIn ? withColor(h(StatusDot, { size: "xs", pulse, class: pulse ? "m-badge-dot-pulse" : mark ? "m-badge-dot-mark" : null }), props.dotColor) : null,
    props.children);
}
