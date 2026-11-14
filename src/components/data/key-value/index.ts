// KeyValue (hadi-march/ui). Folder: src/components/data/key-value/.
import "./key-value.css";
import { h } from "../../../dom/h.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";

/** A KeyValue row. */
export interface KeyValueItem { label: MaybeFn<unknown>; value: MaybeFn<unknown>; hint?: MaybeFn<unknown>; hidden?: MaybeFn<boolean> }
export interface KeyValueProps {
  /** Rows, or an object (keys become labels). */
  items: MaybeFn<readonly KeyValueItem[] | Record<string, unknown> | null | undefined>;
  columns?: number;
  /** Shown for null / "" values (default "—"). */
  empty?: unknown;
  class?: ClassProp;
}
/** Definition list for detail views: `<KeyValue items={[{ label: "Email", value: user.email }]} columns={2} />` or an object. */
export function KeyValue(props: KeyValueProps): Element {
  const items = (): readonly KeyValueItem[] => { const v = val(props.items); return Array.isArray(v) ? v : Object.entries(v ?? {}).map(([label, value]) => ({ label, value })); };
  return h("dl", { class: () => cx("hm-kv", (props.columns ?? 0) > 1 && `hm-kv-cols-${Math.min(props.columns ?? 0, 4)}`, val(props.class)) },
    () => items().filter((x) => !val(x.hidden)).map((x) => h("div", { class: "hm-kv-row" },
      h("dt", { class: "hm-kv-label" }, () => val(x.label)),
      h("dd", { class: "hm-kv-value" }, () => { const v = val(x.value); return v == null || v === "" ? (props.empty ?? "—") : v; }, x.hint != null && h("span", { class: "hm-kv-hint" }, () => val(x.hint))))));
}
