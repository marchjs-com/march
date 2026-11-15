// CornerMark (march/media): a small round mark in a corner of a picture, a card or an avatar: the "video" sign
// on a tile, the arrow that appears on a project cover, the "+" on a story ring. The parent must be positioned
// (`position: relative`). Corner, icon, colour, size and look are yours; decorative unless it has a `label`.
import "./corner-mark.css";
import { h } from "../../../dom/h.ts";
import { val, cx, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { type ColorToken } from "../../../theme/colors.ts";

import type { Corner } from "../../layout/bottom-right-controls/index.ts";
// one definition of the corner names (shared with the corner controls), re-exported under the same name
export type { Corner } from "../../layout/bottom-right-controls/index.ts";
export interface CornerMarkProps {
  /** Which corner (logical: "end" is the right side in left-to-right text). Default "top-end". @tr Hangi köşe (mantıksal: soldan sağa metinde "end" sağ taraftır). Varsayılan "top-end". */
  corner?: MaybeFn<Corner | undefined>;
  /** The icon (an icon, text or a node); children work too. @tr İkon (bir ikon, metin ya da düğüm); children da olur. */
  icon?: unknown;
  /** Size: sm, md (default) or lg. @tr Boyut: sm, md (varsayılan) ya da lg. */
  size?: MaybeFn<"sm" | "md" | "lg" | undefined>;
  /** "scrim" (default: dark glass, for photos), "surface" (card colour with a shadow) or "solid" (filled with the colour). @tr "scrim" (varsayılan: fotoğraflar için koyu cam), "surface" (gölgeli kart rengi) ya da "solid" (renkle dolu). */
  variant?: MaybeFn<"scrim" | "surface" | "solid" | undefined>;
  /** A ring in the surface colour around the mark (cuts it out of an avatar). @tr İşaretin çevresinde yüzey renginde bir halka (onu bir avatardan oyar). */
  ring?: MaybeFn<boolean | undefined>;
  /** "always" (default) or "hover": shown while an ancestor with class `m-corner-host` is hovered or has focus inside. @tr "always" (varsayılan) ya da "hover": `m-corner-host` sınıflı bir üst öğenin üzerine gelindiğinde ya da içinde odak varken görünür. */
  show?: MaybeFn<"always" | "hover" | undefined>;
  /** Sits half outside the corner (a badge on an avatar) instead of inside it. @tr Köşenin içinde değil, yarısı dışarıda durur (avatardaki bir rozet gibi). */
  overlap?: MaybeFn<boolean | undefined>;
  /** Accessible name; without it the mark is decorative. @tr Erişilebilir ad; verilmezse işaret süs sayılır. */
  label?: MaybeFn<string | undefined>;
  /** Extra class on the mark. @tr İşarete eklenen sınıf. */
  class?: ClassProp;
  /** Content of the mark (instead of `icon`). @tr İşaretin içeriği (`icon` yerine). */
  children?: unknown;
}

/** `<CornerMark icon={video} />`, `<CornerMark corner="bottom-end" icon={plus} variant="solid" color="brand-orange" ring overlap />` */
export function CornerMark(props: CornerMarkProps): Element {
  const own = props.icon != null ? icon(props.icon, "m-corner-mark-icon") : props.children;
  return h("span", {
    class: () => cx("m-corner-mark", `m-corner-mark-${val(props.corner) ?? "top-end"}`, `m-corner-mark-${val(props.size) ?? "md"}`, `m-corner-mark-${val(props.variant) ?? "scrim"}`,
      val(props.ring) && "is-ringed", val(props.overlap) && "is-overlap", val(props.show) === "hover" && "is-hover", val(props.class)),
    role: () => (val(props.label) ? "img" : null), "aria-label": () => val(props.label) ?? null, "aria-hidden": () => (val(props.label) ? null : "true"),
  }, own);
}
