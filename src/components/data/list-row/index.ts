// ListRow (hadi-march/data): the one row every list is made of: a lead (icon, avatar, dot, thumbnail), a title, a sub
// text and a trail (badge, shortcut, arrow, meta). It is a link with `href`, a button with `onClick`, or a plain
// element (`as`: div, li, span, label) for rows whose host owns the behaviour (an option of a listbox, a tree item, a
// file line). Role, ARIA, `tabindex`, `data-*`, `ref` and listeners pass through to that element, so a menu, a
// command palette, a sidebar or a tree can all build their rows from it. Long titles scroll on hover / focus
// (OverflowText), or are cut or wrapped. Controls that act on the row (`actions`) sit beside a link / button row, never
// inside it.
import "./list-row.css";
import { h } from "../../../dom/h.ts";
import { untrack } from "../../../core/reactive.ts";
import { routerLink } from "../../../dom/link.ts";
import { cx, val, rest, icon, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { OverflowText, type OverflowTextProps } from "../../typography/overflow-text/index.ts";

export interface ListRowProps {
  /** Lead slot: an icon of hadi-march/icons, short text (emoji), or a node (Avatar, StatusDot, an image). */
  lead?: MaybeFn<unknown>;
  /** The main line: text (scrolls when it does not fit) or a node. Children work too. */
  title?: MaybeFn<unknown>;
  /** The second line: text or a node. */
  sub?: MaybeFn<unknown>;
  /** Trail slot inside the row: Badge, Kbd, Chevron, a time, a count. */
  trail?: MaybeFn<unknown>;
  /** Controls that act on the row (IconButton…). Beside a link / button row (never nested in it); at the end of a plain row. */
  actions?: MaybeFn<unknown>;
  /** Makes the row a link (the router's Link when the app has a router). */
  href?: MaybeFn<string | undefined>;
  /** Makes the row a button; with `as`, a click listener on that element. */
  onClick?: ((e: MouseEvent) => void) | undefined;
  /** Element of a row that is not a link or a button (default "div"): "li" for an option, "span" inside your own button, "label". */
  as?: "div" | "li" | "span" | "label" | undefined;
  /** The current row (this page, the highlighted option): tinted. A link also gets `aria-current="page"`. */
  active?: MaybeFn<boolean | undefined>;
  /** A chosen row. Said as `aria-pressed` on a button, `aria-checked` / `aria-selected` with a matching `role`. */
  selected?: MaybeFn<boolean | undefined>;
  disabled?: MaybeFn<boolean | undefined>;
  /** Hover look and pointer for a plain row whose host handles the click (a listbox option). Links and buttons have it. */
  interactive?: MaybeFn<boolean | undefined>;
  /** sm · md (default) · lg. */
  size?: MaybeFn<"sm" | "md" | "lg" | undefined>;
  /** Theme colour token of the active / selected tint (default: the accent). */
  color?: MaybeFn<ColorToken | undefined>;
  /** Vertical alignment of lead and trail: "center" (default) or "start" (rows with long wrapped text). */
  align?: MaybeFn<"center" | "start" | undefined>;
  /** Text that does not fit: "scroll" (default: OverflowText), "ellipsis", or "wrap". */
  overflow?: "scroll" | "ellipsis" | "wrap" | undefined;
  /** Options of the scrolling text (`{ mode: "loop", speed: 60 }`). */
  marquee?: Partial<OverflowTextProps> | undefined;
  /** A bar at the start edge of the active row (default false). */
  indicator?: MaybeFn<boolean | undefined>;
  /** Native tooltip (the HTML `title` attribute; the `title` prop is the main line). */
  tooltip?: MaybeFn<string | null | undefined>;
  class?: ClassProp;
  children?: unknown;
  /** Other attributes go to the row element: `role`, `aria-*`, `tabindex`, `data-*`, `id`, `ref`, listeners. */
  [attr: string]: unknown;
}

const USED = ["lead", "title", "sub", "trail", "actions", "href", "onClick", "as", "active", "selected", "disabled", "interactive", "size", "color", "align", "overflow", "marquee", "indicator", "tooltip"];
const CHECKED = ["radio", "checkbox", "menuitemradio", "menuitemcheckbox", "switch"];
const SELECTED = ["option", "tab", "treeitem", "row", "gridcell"];
const isText = (x: unknown): boolean => typeof x === "string" || typeof x === "number";

/** `<ListRow lead={home} title="Home" sub="Overview" trail={<Badge count={3} />} href="/" active />`, `<ListRow as="li" role="option" aria-selected={on} title={cmd.title} trail={<Kbd keys="mod+k" />} />` */
export function ListRow(props: ListRowProps): Element {
  const kind = props.href != null ? "a" : props.onClick && !props.as ? "button" : props.as ?? "div";
  const role = props.role as string | undefined;
  const on = (k: "active" | "selected" | "disabled"): boolean => !!val(props[k]);
  const mode = props.overflow ?? "scroll";

  // one text line: plain text scrolls when clipped (or is cut / wrapped); a node is placed as it is
  const line = (name: string, v: MaybeFn<unknown>): unknown => {
    if (v == null) return null;
    const cls = `hm-listrow-${name}`;
    return isText(untrack(() => val(v))) && mode === "scroll"
      ? h(OverflowText, { class: cls, text: () => String(val(v) ?? ""), play: () => on("active") || on("selected"), ...props.marquee })
      : h("span", { class: cls }, () => val(v));
  };
  const slot = (name: string, v: MaybeFn<unknown>): unknown => () => {
    const x = val(v);
    return x == null || x === false ? null : h("span", { class: `hm-listrow-${name}` }, name === "lead" ? icon(x, "hm-icon hm-listrow-icon") : x);
  };
  const title = props.title ?? props.children;
  const nested = kind === "a" || kind === "button"; // controls may not sit inside a link or a button
  const body = [
    slot("lead", props.lead),
    title == null && props.sub == null ? null : h("span", { class: "hm-listrow-text" }, line("title", title), line("sub", props.sub)),
    slot("trail", props.trail),
    nested ? null : slot("actions", props.actions),
  ];

  // how "selected" is said: by the role given, aria-pressed for a plain button, nothing for a plain element
  const said = props.selected === undefined ? null : role ? (CHECKED.includes(role) ? "aria-checked" : SELECTED.includes(role) ? "aria-selected" : null) : kind === "button" ? "aria-pressed" : null;
  const attrs: Record<string, unknown> = {
    title: () => val(props.tooltip) ?? null,
    ...(said ? { [said]: () => String(on("selected")) } : {}),
    ...(kind === "a" ? { "aria-current": () => (on("active") ? "page" : null) } : {}),
    ...(kind === "button" ? { type: "button", disabled: () => on("disabled") } : { "aria-disabled": () => (on("disabled") ? "true" : null) }),
    ...rest(props, USED),
    class: () => cx("hm-listrow", `hm-listrow-${val(props.size) ?? "md"}`, mode !== "scroll" && `is-${mode}`, val(props.align) === "start" && "is-top",
      (nested || !!props.onClick || val(props.interactive)) && "is-action", on("active") && "is-active", on("selected") && "is-selected", on("disabled") && "is-disabled",
      val(props.indicator) && "is-barred", val(props.class)),
    "data-hm-color": () => colorAttr(val(props.color)),
    onClick: props.onClick ? (e: MouseEvent) => { if (on("disabled")) { e.preventDefault(); return; } props.onClick?.(e); } : undefined,
  };
  let row: Element;
  if (kind === "a") {
    const L = routerLink();
    const link = { ...attrs, href: () => (on("disabled") ? null : val(props.href) ?? null) };
    row = (L ? h(L, { ...link, children: body }) : h("a", link, body)) as Element;
  } else row = h(kind, attrs, body) as Element;
  return nested && props.actions != null
    ? h("div", { class: "hm-listrow-wrap" }, row, slot("actions", props.actions)) as Element
    : row;
}
