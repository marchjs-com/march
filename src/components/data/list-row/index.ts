// ListRow (hadi-march/data): the one row every list is made of: a lead (icon, avatar, dot, thumbnail), a title, a sub
// text and a trail (badge, shortcut, arrow, meta). It is a link with `href`, a button with `onClick`, or a plain
// element (`as`: div, li, span, label) for rows whose host owns the behaviour (an option of a listbox, a tree item, a
// file line). Role, ARIA, `tabindex`, `data-*`, `ref` and listeners pass through to that element, so a menu, a
// command palette, a sidebar or a tree can all build their rows from it. Long titles scroll on hover / focus
// (OverflowText), or are cut or wrapped. Controls that act on the row (`actions`) sit beside a link / button row, never
// inside it.
import { h } from "../../../dom/h.ts";
import { OverflowText } from "../../typography/overflow-text/index.ts";
import { listRow, type ListRowProps } from "./core.ts";

export type { ListRowProps } from "./core.ts";

/** `<ListRow lead={home} title="Home" sub="Overview" trail={<Badge count={3} />} href="/" active />`, `<ListRow as="li" role="option" aria-selected={on} title={cmd.title} trail={<Kbd keys="mod+k" />} />` */
export function ListRow(props: ListRowProps): Element {
  return listRow(props, (cls, text, play) => h(OverflowText, { class: cls, text, play, ...props.marquee }));
}
