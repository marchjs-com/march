// JsonView: collapsible read-only JSON tree (hadi-march/ui). Folder: src/components/data/json-view/.
import "./json-view.css";
import { signal, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";

function jsonNode(key: string | number | null, value: unknown, depth: number, openDepth: number, seen: Set<object>): Element {
  const keyEl = key != null && [h("span", { class: "hm-json-key" }, typeof key === "number" ? String(key) : JSON.stringify(key)), h("span", { class: "hm-json-punct" }, ": ")];
  if (value === null || typeof value !== "object") {
    const type = value === null ? "null" : typeof value;
    const text = type === "string" ? JSON.stringify(value) : type === "undefined" ? "undefined" : type === "bigint" ? `${value as bigint}n` : String(value);
    return h("li", { class: "hm-json-row" }, keyEl, h("span", { class: `hm-json-${type}` }, text));
  }
  if (seen.has(value)) return h("li", { class: "hm-json-row" }, keyEl, h("span", { class: "hm-json-null" }, "[circular]"));
  seen.add(value);
  const arr = Array.isArray(value);
  const entries: [string | number, unknown][] | null = arr ? (value as unknown[]).map((v, i) => [i, v]) : value instanceof Date ? null : Object.entries(value);
  if (!entries) return h("li", { class: "hm-json-row" }, keyEl, h("span", { class: "hm-json-string" }, JSON.stringify(value)));
  const open = signal(depth < openDepth);
  const [o, c] = arr ? ["[", "]"] : ["{", "}"];
  const kids = (): Element[] => untrack(() => entries.map(([k, v]) => jsonNode(k, v, depth + 1, openDepth, new Set(seen))));
  return h("li", { class: "hm-json-row" },
    h("button", { type: "button", class: "hm-json-toggle", "aria-expanded": () => String(open()), onClick: () => open.update((x) => !x) },
      keyEl, h("span", { class: "hm-json-punct" }, o),
      () => (open() ? null : h("span", { class: "hm-json-more" }, ` ${entries.length} ${arr ? t`items` : t`keys`} ${c}`))),
    () => open() && [h("ul", { class: "hm-json-list", role: "group" }, kids()), h("span", { class: "hm-json-punct" }, c)]);
}
export interface JsonViewProps { value: MaybeFn<unknown>; /** Initially expanded depth (default 1). */ open?: number; class?: ClassProp }
/** Collapsible read-only JSON tree: `<JsonView value={obj} open={1} />` (open = initially expanded depth). */
export function JsonView(props: JsonViewProps): Element {
  return h("div", { class: () => cx("hm-json", val(props.class)) },
    h("ul", { class: "hm-json-list hm-json-root", role: "tree" }, () => { const v = val(props.value); return untrack(() => jsonNode(null, v, 0, props.open ?? 1, new Set())); }));
}
