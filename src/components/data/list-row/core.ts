// The ListRow element without the scrolling text: ListRow (index.ts) adds OverflowText, PlainListRow leaves it out.
import "./list-row.css";
import { h } from "../../../dom/h.ts";
import { untrack } from "../../../core/reactive.ts";
import { routerLink } from "../../../dom/link.ts";
import { cx, val, rest, icon, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import type { OverflowTextProps } from "../../typography/overflow-text/index.ts";

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
  /** Element of a row that is not a link or a button (default "div"): "li" for an option, "span" inside your own button, "label", "article" for a tile. "button": a button whose host listens itself (drag handle, pointer and key listeners) instead of `onClick`. */
  as?: "div" | "li" | "span" | "label" | "button" | "article" | undefined;
  /** Element of the title (default a span): "h3" … for a tile whose title is a heading. A heading wraps instead of scrolling. */
  titleAs?: "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "div" | "span" | undefined;
  /** Element of the sub text (default a span): "p" for a paragraph under a heading. */
  subAs?: "p" | "div" | "span" | undefined;
  /** "row" (default: lead beside the text) or "column" (a tile: lead above the text, the trail under it). */
  direction?: MaybeFn<"row" | "column" | undefined>;
  /** The current row (this page, the highlighted option): tinted. A link also gets `aria-current="page"`. */
  active?: MaybeFn<boolean | undefined>;
  /** A chosen row. Said as `aria-pressed` on a button, `aria-checked` / `aria-selected` with a matching `role`. */
  selected?: MaybeFn<boolean | undefined>;
  disabled?: MaybeFn<boolean | undefined>;
  /** Hover look and pointer for a plain row whose host handles the click (a listbox option). Links and buttons have it. */
  interactive?: MaybeFn<boolean | undefined>;
  /** xs (a status bar item, a dense strip) · sm · md (default) · lg. */
  size?: MaybeFn<"xs" | "sm" | "md" | "lg" | undefined>;
  /** Theme colour token of the active / selected tint (default: the accent). */
  color?: MaybeFn<ColorToken | undefined>;
  /** Vertical alignment of lead and trail: "center" (default) or "start" (rows with long wrapped text). In a column: "start" (default) or "center" (a centred tile). */
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

const USED = ["lead", "title", "sub", "trail", "actions", "href", "onClick", "as", "titleAs", "subAs", "direction", "active", "selected", "disabled", "interactive", "size", "color", "align", "overflow", "marquee", "indicator", "tooltip"];
const CHECKED = ["radio", "checkbox", "menuitemradio", "menuitemcheckbox", "switch"];
const SELECTED = ["option", "tab", "treeitem", "row", "gridcell"];
const isText = (x: unknown): boolean => typeof x === "string" || typeof x === "number";

/** Draws one line of text that scrolls when it does not fit (ListRow gives OverflowText). */
export type ScrollLine = (cls: string, text: () => string, play: () => boolean) => unknown;

/**
 * The row itself. `scroll` draws a text line that scrolls when clipped; without it (PlainListRow) the row never loads
 * the scrolling text: `overflow="scroll"` is cut like "ellipsis".
 */
export function listRow(props: ListRowProps, scroll?: ScrollLine): Element {
  const kind = props.href != null ? "a" : props.onClick && !props.as ? "button" : props.as ?? "div";
  const role = props.role as string | undefined;
  const on = (k: "active" | "selected" | "disabled"): boolean => !!val(props[k]);
  const mode = props.overflow === "scroll" || !props.overflow ? (scroll ? "scroll" : "ellipsis") : props.overflow;

  // one text line: plain text scrolls when clipped (or is cut / wrapped); a node is placed as it is
  const line = (name: string, v: MaybeFn<unknown>, as?: string): unknown => {
    if (v == null) return null;
    const cls = `hm-listrow-${name}`;
    return scroll && isText(untrack(() => val(v))) && mode === "scroll" && !as
      ? scroll(cls, () => String(val(v) ?? ""), () => on("active") || on("selected"))
      : h(as ?? "span", { class: cls }, () => val(v));
  };
  const column = (): boolean => val(props.direction) === "column";
  const blocks = (props.titleAs ?? "span") !== "span" || (props.subAs ?? "span") !== "span"; // a heading / paragraph needs a block parent
  const slot = (name: string, v: MaybeFn<unknown>): unknown => () => {
    const x = val(v);
    return x == null || x === false ? null : h("span", { class: `hm-listrow-${name}` }, name === "lead" ? icon(x, "hm-icon hm-listrow-icon") : x);
  };
  const title = props.title ?? props.children;
  const nested = kind === "a" || kind === "button"; // controls may not sit inside a link or a button
  const body = [
    slot("lead", props.lead),
    title == null && props.sub == null ? null : h(blocks ? "div" : "span", { class: "hm-listrow-text" }, line("title", title, props.titleAs), line("sub", props.sub, props.subAs)),
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
      column() && "is-column", column() && val(props.align) === "center" && "is-centered",
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

/**
 * ListRow without the scrolling text (long titles are cut or wrap): the same element, classes and props for light
 * components that must not load OverflowText (an accordion header, a toast line).
 * `<PlainListRow onClick={toggle} lead={icon} title="Shipping" sub="2–4 days" trail={<Chevron />} overflow="wrap" />`
 */
export function PlainListRow(props: ListRowProps): Element { return listRow(props); }
