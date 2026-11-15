// LinkCard (march/navigation): a card that is one link: an icon tile, a title, a description, a small text at the
// end and an arrow that appears on hover. Every part is optional or yours: the lead (own node instead of the tile), the
// arrow (off, or your own), the colour of the tile.
import "./link-card.css";
import { h } from "../../../dom/h.ts";
import { Link, type Href } from "../../../router/router.ts";
import { val, cx, glyph, rest, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { arrowUpRight } from "../../../icons/glyphs/arrowUpRight.ts";
import { OverflowText } from "../../typography/overflow-text/index.ts";
import { IconTile, type IconTone } from "../../data/icon-tile/index.ts";
import { withColor } from "../../../theme/colors.ts";

export interface LinkCardProps {
  /** The whole card links here (router `Link`: prefetch, active state). @tr Kartın tamamı bu bağlantıdır (router `Link`: önceden yükleme, etkin durum). */
  href: Href;
  /** The title: one line; it scrolls on hover when it does not fit. @tr Başlık: tek satır; sığmazsa üzerine gelince kayar. */
  title: MaybeFn<unknown>;
  /** Description text or node under the title. @tr Başlığın altındaki açıklama metni ya da düğümü. */
  description?: MaybeFn<unknown>;
  /** Icon drawn in an IconTile. @tr IconTile içinde çizilen ikon. */
  icon?: unknown;
  /** IconTile tone of the icon tile (default primary). @tr İkon kutusunun IconTile tonu (varsayılan primary). */
  tone?: MaybeFn<IconTone | undefined>;
  /** Theme colour token of the icon tile (wins over `tone`). @tr İkon kutusunun tema renk belirteci (`tone`'a baskın gelir). */
  color?: MaybeFn<ColorToken | undefined>;
  /** Own node at the start instead of the icon tile (an Avatar, a picture). @tr İkon kutusu yerine başta kendi düğümün (bir Avatar, bir resim). */
  lead?: unknown;
  /** Small text on the right (a count, a status). @tr Sağda küçük metin (bir sayı, bir durum). */
  meta?: MaybeFn<unknown>;
  /** The arrow shown on hover and focus: true (default), false, or your own node. @tr Üzerine gelince ve odakta görünen ok: true (varsayılan), false ya da kendi düğümün. */
  arrow?: boolean | Node | undefined;
  /** Extra class on the card. @tr Karta eklenen sınıf. */
  class?: ClassProp;
  [attr: string]: unknown;
}
/** A navigational card: `<LinkCard href="/users" icon={users} title="Members" description="Search and manage" />` */
export function LinkCard(props: LinkCardProps): Element {
  return h(Link, {
    ...rest(props, ["href", "title", "description", "icon", "tone", "color", "lead", "meta", "arrow", "class"]),
    href: props.href, class: () => cx("m-link-card", val(props.class)),
    children: [
      props.lead != null ? h("span", { class: "m-link-card-lead" }, props.lead) : props.icon != null && withColor(h(IconTile, { icon: props.icon, tone: props.tone }), props.color),
      h("span", { class: "m-link-card-text" },
        h(OverflowText, { class: "m-link-card-title" }, () => val(props.title)),
        props.description != null && h("span", { class: "m-link-card-desc" }, () => val(props.description))),
      props.meta != null && h("span", { class: "m-link-card-meta" }, () => val(props.meta)),
      props.arrow === false ? null : h("span", { class: "m-link-card-arrow", "aria-hidden": "true" }, props.arrow && props.arrow !== true ? props.arrow : glyph(arrowUpRight)),
    ],
  }) as Element;
}
