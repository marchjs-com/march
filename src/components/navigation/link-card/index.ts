// LinkCard (hadi-march/navigation): a card that is one link: an icon tile, a title, a description, a small text at the
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

export interface LinkCardProps {
  href: Href;
  title: MaybeFn<unknown>;
  description?: MaybeFn<unknown>;
  icon?: unknown;
  tone?: MaybeFn<IconTone | undefined>;
  /** Theme colour token of the icon tile (wins over `tone`). */
  color?: MaybeFn<ColorToken | undefined>;
  /** Own node at the start instead of the icon tile (an Avatar, a picture). */
  lead?: unknown;
  /** Small text on the right (a count, a status). */
  meta?: MaybeFn<unknown>;
  /** The arrow shown on hover and focus: true (default), false, or your own node. */
  arrow?: boolean | Node | undefined;
  class?: ClassProp;
  [attr: string]: unknown;
}
/** A navigational card: `<LinkCard href="/users" icon={users} title="Members" description="Search and manage" />` */
export function LinkCard(props: LinkCardProps): Element {
  return h(Link, {
    ...rest(props, ["href", "title", "description", "icon", "tone", "color", "lead", "meta", "arrow", "class"]),
    href: props.href, class: () => cx("m-link-card", val(props.class)),
    children: [
      props.lead != null ? h("span", { class: "m-link-card-lead" }, props.lead) : props.icon != null && h(IconTile, { icon: props.icon, tone: props.tone, color: props.color }),
      h("span", { class: "m-link-card-text" },
        h(OverflowText, { class: "m-link-card-title" }, () => val(props.title)),
        props.description != null && h("span", { class: "m-link-card-desc" }, () => val(props.description))),
      props.meta != null && h("span", { class: "m-link-card-meta" }, () => val(props.meta)),
      props.arrow === false ? null : h("span", { class: "m-link-card-arrow", "aria-hidden": "true" }, props.arrow && props.arrow !== true ? props.arrow : glyph(arrowUpRight)),
    ],
  }) as Element;
}
