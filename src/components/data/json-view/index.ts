// JsonView: collapsible read-only JSON tree (hadi-march/ui). Folder: src/components/data/json-view/.
import "./json-view.css";
import { signal, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";

/** Texts JsonView writes itself. */
export interface JsonViewLabels {
  /** After the count of a closed array ("3 items"). */
  items: string;
  /** After the count of a closed object ("3 keys"). */
  keys: string;
  /** Stands in for a circular reference. */
  circular: string;
}
type Arrow = boolean | ((open: () => boolean) => unknown) | undefined;
interface NodeOptions { openDepth: number; labels: Partial<JsonViewLabels> | undefined; arrow: Arrow }

function jsonNode(key: string | number | null, value: unknown, depth: number, o: NodeOptions, seen: Set<object>): Element {
  const keyEl = key != null && [h("span", { class: "hm-json-key" }, typeof key === "number" ? String(key) : JSON.stringify(key)), h("span", { class: "hm-json-punct" }, ": ")];
  if (value === null || typeof value !== "object") {
    const type = value === null ? "null" : typeof value;
    const text = type === "string" ? JSON.stringify(value) : type === "undefined" ? "undefined" : type === "bigint" ? `${value as bigint}n` : String(value);
    return h("li", { class: "hm-json-row" }, keyEl, h("span", { class: `hm-json-${type}` }, text));
  }
  if (seen.has(value)) return h("li", { class: "hm-json-row" }, keyEl, h("span", { class: "hm-json-null" }, o.labels?.circular ?? "[circular]"));
  seen.add(value);
  const arr = Array.isArray(value);
  const entries: [string | number, unknown][] | null = arr ? (value as unknown[]).map((v, i) => [i, v]) : value instanceof Date ? null : Object.entries(value);
  if (!entries) return h("li", { class: "hm-json-row" }, keyEl, h("span", { class: "hm-json-string" }, JSON.stringify(value)));
  const open = signal(depth < o.openDepth);
  const [ob, cb] = arr ? ["[", "]"] : ["{", "}"];
  const kids = (): Element[] => untrack(() => entries.map(([k, v]) => jsonNode(k, v, depth + 1, o, new Set(seen))));
  return h("li", { class: "hm-json-row" },
    h("button", { type: "button", class: cx("hm-json-toggle", o.arrow === false && "is-plain", typeof o.arrow === "function" && "is-own"), "aria-expanded": () => String(open()), onClick: () => open.update((x) => !x) },
      typeof o.arrow === "function" ? h("span", { class: "hm-json-arrow", "aria-hidden": "true" }, o.arrow(open)) : null,
      keyEl, h("span", { class: "hm-json-punct" }, ob),
      () => (open() ? null : h("span", { class: "hm-json-more" }, ` ${entries.length} ${arr ? o.labels?.items ?? t`items` : o.labels?.keys ?? t`keys`} ${cb}`))),
    () => open() && [h("ul", { class: "hm-json-list", role: "group" }, kids()), h("span", { class: "hm-json-punct" }, cb)]);
}
export interface JsonViewProps {
  value: MaybeFn<unknown>;
  /** Initially expanded depth (default 1). */
  open?: number;
  /** Your own texts: `{ items, keys, circular }`. */
  labels?: Partial<JsonViewLabels> | undefined;
  /** The open / close arrow: true (default), false, or `(open) => node` (`open()` is live). */
  arrow?: boolean | ((open: () => boolean) => unknown) | undefined;
  /** Accessible name of the tree. */
  label?: MaybeFn<string | undefined>;
  class?: ClassProp;
}
/** Collapsible read-only JSON tree: `<JsonView value={obj} open={1} />` (open = initially expanded depth). */
export function JsonView(props: JsonViewProps): Element {
  return h("div", { class: () => cx("hm-json", val(props.class)) },
    h("ul", { class: "hm-json-list hm-json-root", role: "tree", "aria-label": () => val(props.label) ?? null }, () => { const v = val(props.value); return untrack(() => jsonNode(null, v, 0, { openDepth: props.open ?? 1, labels: props.labels, arrow: props.arrow }, new Set())); }));
}
