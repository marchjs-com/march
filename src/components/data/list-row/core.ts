// The ListRow element without the scrolling text: ListRow (index.ts) adds OverflowText, PlainListRow leaves it out.
import "./list-row.css";
import { h } from "../../../dom/h.ts";
import { untrack } from "../../../core/reactive.ts";
import { routerLink } from "../../../dom/link.ts";
import { cx, val, rest, icon, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import type { OverflowTextProps } from "../../typography/overflow-text/index.ts";

export interface ListRowProps {
  /** Lead slot: an icon of march/icons, short text (emoji), or a node (Avatar, StatusDot, an image). @tr Baş yuvası: march/icons'tan bir ikon, kısa metin (emoji) ya da bir düğüm (Avatar, StatusDot, bir görsel). */
  lead?: MaybeFn<unknown>;
  /** The main line: text (scrolls when it does not fit) or a node. Children work too. @tr Ana satır: metin (sığmazsa kayar) ya da bir düğüm. Alt ögeler de olur. */
  title?: MaybeFn<unknown>;
  /** The second line: text or a node. @tr İkinci satır: metin ya da bir düğüm. */
  sub?: MaybeFn<unknown>;
  /** Trail slot inside the row: Badge, Kbd, Chevron, a time, a count. @tr Satırın içindeki son yuva: Badge, Kbd, Chevron, bir saat, bir sayı. */
  trail?: MaybeFn<unknown>;
  /** Controls that act on the row (IconButton…). Beside a link / button row (never nested in it); at the end of a plain row. @tr Satır üzerinde iş gören denetimler (IconButton…). Bağlantı / düğme satırının yanında (asla içinde değil); düz satırda sonda. */
  actions?: MaybeFn<unknown>;
  /** Makes the row a link (the router's Link when the app has a router). @tr Satırı bağlantı yapar (uygulamada router varsa router'ın Link'i). */
  href?: MaybeFn<string | undefined>;
  /** Makes the row a button; with `as`, a click listener on that element. @tr Satırı düğme yapar; `as` ile o ögeye bir tıklama dinleyicisi ekler. */
  onClick?: ((e: MouseEvent) => void) | undefined;
  /** Element of a row that is not a link or a button (default "div"): "li" for an option, "span" inside your own button, "label", "article" for a tile. "button": a button whose host listens itself (drag handle, pointer and key listeners) instead of `onClick`. @tr Bağlantı ya da düğme olmayan satırın ögesi (varsayılan "div"): seçenek için "li", kendi düğmenizin içinde "span", "label", karo için "article". "button": `onClick` yerine dinleyicileri kendisi kuran bir düğme (sürükleme tutamacı, işaretçi ve tuş dinleyicileri). */
  as?: "div" | "li" | "span" | "label" | "button" | "article" | undefined;
  /** Element of the title (default a span): "h3" … for a tile whose title is a heading. A heading wraps instead of scrolling. @tr Başlığın ögesi (varsayılan span): başlığı bir heading olan karo için "h3" … Heading kaymaz, alt satıra geçer. */
  titleAs?: "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "div" | "span" | undefined;
  /** Element of the sub text (default a span): "p" for a paragraph under a heading. @tr Alt metnin ögesi (varsayılan span): bir heading altındaki paragraf için "p". */
  subAs?: "p" | "div" | "span" | undefined;
  /** "row" (default: lead beside the text) or "column" (a tile: lead above the text, the trail under it). @tr "row" (varsayılan: baş metnin yanında) ya da "column" (karo: baş metnin üstünde, son yuva altında). */
  direction?: MaybeFn<"row" | "column" | undefined>;
  /** The current row (this page, the highlighted option): tinted. A link also gets `aria-current="page"`. @tr Geçerli satır (bu sayfa, vurgulanan seçenek): renklendirilir. Bağlantı ayrıca `aria-current="page"` alır. */
  active?: MaybeFn<boolean | undefined>;
  /** A chosen row. Said as `aria-pressed` on a button, `aria-checked` / `aria-selected` with a matching `role`. @tr Seçilmiş satır. Düğmede `aria-pressed`, uygun `role` ile `aria-checked` / `aria-selected` olarak bildirilir. */
  selected?: MaybeFn<boolean | undefined>;
  /** The row cannot be used: dimmed, and a link or button is disabled. @tr Satır kullanılamaz: soluklaşır, bağlantı ya da düğme devre dışı olur. */
  disabled?: MaybeFn<boolean | undefined>;
  /** Hover look and pointer for a plain row whose host handles the click (a listbox option). Links and buttons have it. @tr Tıklamayı ev sahibinin yönettiği düz satır için üzerine gelme görünümü ve işaretçi (liste kutusu seçeneği). Bağlantı ve düğmelerde zaten vardır. */
  interactive?: MaybeFn<boolean | undefined>;
  /** xs (a status bar item, a dense strip) · sm · md (default) · lg. @tr xs (durum çubuğu ögesi, sık bir şerit) · sm · md (varsayılan) · lg. */
  size?: MaybeFn<"xs" | "sm" | "md" | "lg" | undefined>;
  /** Theme colour token of the active / selected tint (default: the accent). @tr Etkin / seçili renginin tema renk belirteci (varsayılan: vurgu rengi). */
  color?: MaybeFn<ColorToken | undefined>;
  /** Vertical alignment of lead and trail: "center" (default) or "start" (rows with long wrapped text). In a column: "start" (default) or "center" (a centred tile). @tr Baş ve son yuvanın dikey hizası: "center" (varsayılan) ya da "start" (uzun, kaydırılan metinli satırlar). Sütunda: "start" (varsayılan) ya da "center" (ortalanmış karo). */
  align?: MaybeFn<"center" | "start" | undefined>;
  /** Text that does not fit: "scroll" (default: OverflowText), "ellipsis", or "wrap". @tr Sığmayan metin: "scroll" (varsayılan: OverflowText), "ellipsis" ya da "wrap". */
  overflow?: "scroll" | "ellipsis" | "wrap" | undefined;
  /** Options of the scrolling text (`{ mode: "loop", speed: 60 }`). @tr Kayan metnin seçenekleri (`{ mode: "loop", speed: 60 }`). */
  marquee?: Partial<OverflowTextProps> | undefined;
  /** A bar at the start edge of the active row (default false). @tr Etkin satırın başlangıç kenarında bir çubuk (varsayılan false). */
  indicator?: MaybeFn<boolean | undefined>;
  /** Native tooltip (the HTML `title` attribute; the `title` prop is the main line). @tr Tarayıcının ipucu (HTML `title` özniteliği; `title` özelliği ana satırdır). */
  tooltip?: MaybeFn<string | null | undefined>;
  /** Extra CSS classes on the row. @tr Satıra eklenen CSS sınıfları. */
  class?: ClassProp;
  /** Main line content when `title` is not given. @tr `title` verilmediğinde ana satırın içeriği. */
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
    const cls = `m-listrow-${name}`;
    return scroll && isText(untrack(() => val(v))) && mode === "scroll" && !as
      ? scroll(cls, () => String(val(v) ?? ""), () => on("active") || on("selected"))
      : h(as ?? "span", { class: cls }, () => val(v));
  };
  const column = (): boolean => val(props.direction) === "column";
  const blocks = (props.titleAs ?? "span") !== "span" || (props.subAs ?? "span") !== "span"; // a heading / paragraph needs a block parent
  const slot = (name: string, v: MaybeFn<unknown>): unknown => () => {
    const x = val(v);
    return x == null || x === false ? null : h("span", { class: `m-listrow-${name}` }, name === "lead" ? icon(x, "m-icon m-listrow-icon") : x);
  };
  const title = props.title ?? props.children;
  const nested = kind === "a" || kind === "button"; // controls may not sit inside a link or a button
  const body = [
    slot("lead", props.lead),
    title == null && props.sub == null ? null : h(blocks ? "div" : "span", { class: "m-listrow-text" }, line("title", title, props.titleAs), line("sub", props.sub, props.subAs)),
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
    class: () => cx("m-listrow", `m-listrow-${val(props.size) ?? "md"}`, mode !== "scroll" && `is-${mode}`, val(props.align) === "start" && "is-top",
      column() && "is-column", column() && val(props.align) === "center" && "is-centered",
      (nested || !!props.onClick || val(props.interactive)) && "is-action", on("active") && "is-active", on("selected") && "is-selected", on("disabled") && "is-disabled",
      val(props.indicator) && "is-barred", val(props.class)),
    "data-m-color": () => colorAttr(val(props.color)),
    onClick: props.onClick ? (e: MouseEvent) => { if (on("disabled")) { e.preventDefault(); return; } props.onClick?.(e); } : undefined,
  };
  let row: Element;
  if (kind === "a") {
    const L = routerLink();
    const link = { ...attrs, href: () => (on("disabled") ? null : val(props.href) ?? null) };
    row = (L ? h(L, { ...link, children: body }) : h("a", link, body)) as Element;
  } else row = h(kind, attrs, body) as Element;
  return nested && props.actions != null
    ? h("div", { class: "m-listrow-wrap" }, row, slot("actions", props.actions)) as Element
    : row;
}

/**
 * ListRow without the scrolling text (long titles are cut or wrap): the same element, classes and props for light
 * components that must not load OverflowText (an accordion header, a toast line).
 * `<PlainListRow onClick={toggle} lead={icon} title="Shipping" sub="2–4 days" trail={<Chevron />} overflow="wrap" />`
 */
export function PlainListRow(props: ListRowProps): Element { return listRow(props); }
