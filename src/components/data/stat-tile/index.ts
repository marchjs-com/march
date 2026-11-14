// StatTile (hadi-march/data): one value with its label ("1,2 B · Takipçi"): the tile of a profile's numbers, one item of a
// stats band, a summary figure above a list. The value is text or a node (a Counter that rolls); a hint line is
// optional. Plain by default, a soft tile or a bordered card on request; with `onClick` it is a button, with `href` a
// link, with `term` it renders `<dt>` / `<dd>` for use inside a `<dl>`. (The KPI box with a delta and a sparkline is
// the Stat of hadi-march/charts: it draws its label and value with this tile.)
import "./stat-tile.css";
import { h } from "../../../dom/h.ts";
import { routerLink } from "../../../dom/link.ts";
import { cx, val, rest, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

export interface StatTileProps {
  /** The figure: text, a number or a node (`<Counter value={n} />`). */
  value?: MaybeFn<unknown>;
  /** What it counts ("Followers"). */
  label?: MaybeFn<unknown>;
  /** A small line under them ("last 30 days"). */
  hint?: MaybeFn<unknown>;
  /** Theme colour token for the value (and the hover / focus of a clickable stat). */
  color?: MaybeFn<ColorToken | undefined>;
  /** start · center (default) · end. */
  align?: MaybeFn<"start" | "center" | "end" | undefined>;
  /** sm · md (default) · lg · xl. */
  size?: MaybeFn<"sm" | "md" | "lg" | "xl" | undefined>;
  /** plain (default) · tile (soft background) · card (border and surface). */
  variant?: MaybeFn<"plain" | "tile" | "card" | undefined>;
  /** Which line comes first: "value" (default) or "label". */
  order?: MaybeFn<"value" | "label" | undefined>;
  /** Makes it a button. */
  onClick?: ((e: MouseEvent) => void) | undefined;
  /** Makes it a link (the router's Link when the app has a router). */
  href?: MaybeFn<string | undefined>;
  disabled?: MaybeFn<boolean | undefined>;
  /** Render `<dt>` (label) and `<dd>` (value, hint) for a `<dl>` parent; ignored for a button or a link. */
  term?: boolean | undefined;
  /** An extra class on a part, for a host that keeps its own class names (the KPI box of hadi-march/charts): `{ value, label, hint }`. */
  partClass?: Partial<Record<"value" | "label" | "hint", string>> | undefined;
  class?: ClassProp;
  /** Other attributes (`data-*`, `aria-*`, `title`, `id`) go to the root. */
  [attr: string]: unknown;
}

/** `<StatTile value="128" label="Posts" />`, `<StatTile value={<Counter value={$n} />} label="Followers" variant="tile" onClick={open} />` */
export function StatTile(props: StatTileProps): Element {
  const kind = props.href != null ? "a" : props.onClick ? "button" : "div";
  const term = kind === "div" && !!props.term;
  const part = (tag: string, name: string, v: MaybeFn<unknown>): Element | null =>
    (v == null ? null : h(tag, { class: cx(`hm-stat-tile-${name}`, props.partClass?.[name as "value" | "label" | "hint"]) }, () => val(v)) as Element);
  const value = part(term ? "dd" : "span", "value", props.value), label = part(term ? "dt" : "span", "label", props.label);
  // a <dl> needs the term first; the look (value above the label) comes from CSS order either way
  const body = [...(term ? [label, value] : [value, label]), part(term ? "dd" : "span", "hint", props.hint)];
  const off = (): boolean => !!val(props.disabled);
  const attrs = {
    ...rest(props, ["value", "label", "hint", "color", "align", "size", "variant", "order", "onClick", "href", "disabled", "term", "partClass"]),
    class: () => cx("hm-stat-tile", `hm-stat-tile-${val(props.variant) ?? "plain"}`, `hm-stat-tile-${val(props.size) ?? "md"}`, `is-${val(props.align) ?? "center"}`,
      val(props.order) === "label" && "is-label-first", kind !== "div" && "is-action", off() && "is-disabled", val(props.class)),
    "data-hm-color": () => colorAttr(val(props.color)),
  };
  if (kind === "button") return h("button", { ...attrs, type: "button", disabled: off, onClick: props.onClick }, body) as Element;
  if (kind === "a") {
    const href = (): string | null => (off() ? null : val(props.href) ?? null);
    const link = { ...attrs, href, "aria-disabled": () => (off() ? "true" : null), onClick: props.onClick };
    const L = routerLink();
    return (L ? h(L, { ...link, children: body }) : h("a", link, body)) as Element;
  }
  return h("div", attrs, body) as Element;
}
