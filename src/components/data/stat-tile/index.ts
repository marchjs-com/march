// StatTile (march/data): one value with its label ("1,2 B · Takipçi"): the tile of a profile's numbers, one item of a
// stats band, a summary figure above a list. The value is text or a node (a Counter that rolls); a hint line is
// optional. Plain by default, a soft tile or a bordered card on request; with `onClick` it is a button, with `href` a
// link, with `term` it renders `<dt>` / `<dd>` for use inside a `<dl>`. (The KPI box with a delta and a sparkline is
// the Stat of march/charts: it draws its label and value with this tile.)
import "./stat-tile.css";
import { h } from "../../../dom/h.ts";
import { routerLink } from "../../../dom/link.ts";
import { cx, val, rest, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { type ColorToken } from "../../../theme/colors.ts";
import type { Handler } from "../../../core/util.ts";

export interface StatTileProps {
  /** The figure: text, a number or a node (`<Counter value={n} />`). @tr Rakam: metin, sayı ya da bir düğüm (`<Counter value={n} />`). */
  value?: MaybeFn<unknown>;
  /** What it counts ("Followers"). @tr Neyi saydığı ("Takipçi"). */
  label?: MaybeFn<unknown>;
  /** A small line under them ("last 30 days"). @tr Altlarında küçük bir satır ("son 30 gün"). */
  hint?: MaybeFn<unknown>;
  /** start · center (default) · end. @tr start · center (varsayılan) · end. */
  align?: MaybeFn<"start" | "center" | "end" | undefined>;
  /** sm · md (default) · lg · xl. @tr sm · md (varsayılan) · lg · xl. */
  size?: MaybeFn<"sm" | "md" | "lg" | "xl" | undefined>;
  /** plain (default) · tile (soft background) · card (border and surface). @tr plain (varsayılan) · tile (hafif arka plan) · card (kenarlık ve yüzey). */
  variant?: MaybeFn<"plain" | "tile" | "card" | undefined>;
  /** Which line comes first: "value" (default) or "label". @tr Hangi satır önce gelir: "value" (varsayılan) ya da "label". */
  order?: MaybeFn<"value" | "label" | undefined>;
  /** Makes it a button. @tr Onu bir düğme yapar. */
  onClick?: Handler<[e: MouseEvent]> | undefined;
  /** Makes it a link (the router's Link when the app has a router). @tr Onu bir bağlantı yapar (uygulamada router varsa router'ın Link'i). */
  href?: MaybeFn<string | undefined>;
  /** A button or link tile cannot be used: dimmed and not clickable. @tr Düğme ya da bağlantı olan karo kullanılamaz: soluklaşır, tıklanmaz. */
  disabled?: MaybeFn<boolean | undefined>;
  /** Render `<dt>` (label) and `<dd>` (value, hint) for a `<dl>` parent; ignored for a button or a link. @tr Bir `<dl>` ebeveyni için `<dt>` (etiket) ve `<dd>` (değer, ipucu) çizer; düğme ya da bağlantıda yok sayılır. */
  term?: boolean | undefined;
  /** Where the hint goes: "tile" (default: its own line, last) or "value" (inside the value element: one `<dd>` per term). @tr İpucunun yeri: "tile" (varsayılan: kendi satırı, en sonda) ya da "value" (değer ögesinin içinde: terim başına tek `<dd>`). */
  hintIn?: "tile" | "value" | undefined;
  /** "figure" (default): the value is a heavy number · "text": the value reads as body text that wraps (a details list). @tr "figure" (varsayılan): değer kalın bir sayıdır · "text": değer alt satıra geçen gövde metni gibi okunur (ayrıntı listesi). */
  emphasis?: "figure" | "text" | undefined;
  /** An extra class on a part, for a host that keeps its own class names (the KPI box of march/charts): `{ value, label, hint }`. @tr Kendi sınıf adlarını koruyan bir ev sahibi için bir parçaya ek sınıf (march/charts'ın KPI kutusu): `{ value, label, hint }`. */
  partClass?: Partial<Record<"value" | "label" | "hint", string>> | undefined;
  /** Extra CSS classes on the tile. @tr Karoya eklenen CSS sınıfları. */
  class?: ClassProp;
  /** Other attributes (`data-*`, `aria-*`, `title`, `id`) go to the root. */
  [attr: string]: unknown;
}

/** `<StatTile value="128" label="Posts" />`, `<StatTile value={<Counter value={$n} />} label="Followers" variant="tile" onClick={open} />` */
export function StatTile(props: StatTileProps): Element {
  const kind = props.href != null ? "a" : props.onClick ? "button" : "div";
  const term = kind === "div" && !!props.term;
  const part = (tag: string, name: string, v: MaybeFn<unknown>, more?: unknown): Element | null =>
    (v == null ? null : h(tag, { class: cx(`m-stat-tile-${name}`, props.partClass?.[name as "value" | "label" | "hint"]) }, () => val(v), more) as Element);
  const inValue = props.hintIn === "value" && props.value != null;
  const value = part(term ? "dd" : "span", "value", props.value, inValue ? part("span", "hint", props.hint) : null), label = part(term ? "dt" : "span", "label", props.label);
  // a <dl> needs the term first; the look (value above the label) comes from CSS order either way
  const body = [...(term ? [label, value] : [value, label]), inValue ? null : part(term ? "dd" : "span", "hint", props.hint)];
  const off = (): boolean => !!val(props.disabled);
  const attrs = {
    ...rest(props, ["value", "label", "hint", "color", "align", "size", "variant", "order", "onClick", "href", "disabled", "term", "partClass", "hintIn", "emphasis"]),
    class: () => cx("m-stat-tile", `m-stat-tile-${val(props.variant) ?? "plain"}`, `m-stat-tile-${val(props.size) ?? "md"}`, `is-${val(props.align) ?? "center"}`,
      val(props.order) === "label" && "is-label-first", props.emphasis === "text" && "is-text", kind !== "div" && "is-action", off() && "is-disabled", val(props.class)),
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
