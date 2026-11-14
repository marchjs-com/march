// RecordListEditor: edit an array of records (objects) with a sub-schema. Each row shows one compact labelled control per
// field; rows can be added, moved and removed. Registered as the `records` field type / control:
//
//   carriers: { type: "records", label: "Carriers", fields: { name: { type: "text", required: true }, url: "url" }, addLabel: "Add carrier" }
//
// Props: fields (schema spec object or a schema), blank (object or () => object for new rows), max, addLabel, readonly,
// disabled, removable (default true), sortable (default true), cols (fields per line, default = number of fields, max 6).
// Validation (schema type `records`): every row is validated with the sub-schema; the first problem is reported as
// "Row N: <field label>: <message>".
import "./records.css";
import { computed, untrack, type Accessor } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { For } from "../dom/for.ts";
import { t } from "../core/i18n.ts";
import { schema as makeSchema, fieldType, options as schemaOptions, type Schema, type SchemaSpec, type Values, type FieldSpec, type Field as SchemaField } from "../schema/index.ts";
import { model, cx, labelledBy, extend, live, type ControlProps } from "./util.ts";
import { inputFor, registerInput, INLINE_LABEL, type InputComponent } from "./registry.ts";
import { Field } from "./form.ts";
import { rowList, rowToolsProps } from "./rows.ts";
import { Button } from "../components/actions/button/index.ts";
import { RowTools } from "../components/forms/row-tools/index.ts";

const SKIP = new Set(["name", "label", "type", "help", "when", "validate", "default", "column", "format", "hidden", "control", "props",
  "requiredMessage", "pattern", "patternMessage", "span", "readonly", "disabled", "options", "value", "minLength", "section", "variant", "fields", "blank"]);
const TEXTY = new Set(["text", "textarea", "password", "email", "url", "phone"]);

/** Sub-schema of a records field: a spec object or a schema. */
export type RecordFields = SchemaSpec | Schema;

/** Sub-schema of a records field (cached on the spec object). */
const subSchema = (fields: RecordFields | null | undefined): Schema => (fields && typeof fields["validate"] === "function" && fields["fields"] ? fields as Schema : makeSchema((fields ?? {}) as SchemaSpec));
const cache = new WeakMap<object, Schema>();
function schemaOf(f: FieldSpec): Schema {
  if (!f.fields) return makeSchema({});
  const fields = f.fields as RecordFields;
  if (!cache.has(fields)) cache.set(fields, subSchema(fields));
  return cache.get(fields)!;
}

/** First problem in a list of records, or null. */
export function validateRecords(list: readonly (Values | null | undefined)[] | null | undefined, fields: RecordFields | null | undefined): string | null {
  const s = subSchema(fields);
  for (let i = 0; i < (list ?? []).length; i++) {
    const r = s.validate(list![i] ?? {});
    if (!r.ok) {
      const [name, msg] = Object.entries(r.errors)[0]!;
      return t`Row ${i + 1}: ${s.field(name)?.label ?? name}: ${msg}`;
    }
  }
  return null;
}

fieldType("records", {
  coerce: (v, f) => (Array.isArray(v) ? v.map((r: Values | null | undefined) => schemaOf(f ?? {}).parse({ ...(r ?? {}) })).map((r, i) => ({ ...v[i], ...r })) : []),
  empty: [],
  check: (v: Values[], f) => validateRecords(v, schemaOf(f)),
});

export interface RecordListEditorProps extends ControlProps<Values[]> {
  /** Sub-schema: a spec object or a schema. */
  fields?: RecordFields | undefined;
  /** New-row values (or a function returning them). */
  blank?: Values | (() => Values) | undefined;
  max?: number | undefined;
  addLabel?: string | undefined;
  /** Default true. */
  removable?: boolean | undefined;
  /** Default true. */
  sortable?: boolean | undefined;
  /** Fields per line (default: number of fields, max 6). */
  cols?: number | undefined;
}

/** Edit a list of records with a schema: add, remove, reorder, validate each row. */
export function RecordListEditor(props: RecordListEditorProps): unknown {
  const [get, set] = model<Values[]>(props, []);
  const list = () => get() ?? [];
  const sch = computed(() => subSchema(props.fields));
  const rows = rowList(list, set, props);
  const { idx, ro, full } = rows;
  const blank = () => { const b = typeof props.blank === "function" ? props.blank() : props.blank; return { ...untrack(() => sch().defaults()), ...(b ?? {}) }; };
  const edit = (i: number, name: string, v: unknown) => { const cur = [...untrack(list)]; cur[i] = { ...cur[i], [name]: v }; set(cur); };
  const cols = () => Math.min(6, Math.max(1, props.cols ?? sch().fields.filter((f) => !f.hidden && f.type !== "hidden").length));

  const control = (f: SchemaField, i: Accessor<number>) => {
    const Comp: InputComponent | null = inputFor(f);
    if (!Comp) return null;
    const p: Record<string, unknown> = {};
    for (const k of Object.keys(f)) if (!SKIP.has(k)) p[k] = f[k];
    if (TEXTY.has(f.type)) { delete p["min"]; delete p["max"]; if (f.type === "text" && f.max != null) p["maxLength"] = f.maxLength ?? f.max; }
    Object.assign(p, f["props"] ?? {});
    if (INLINE_LABEL.has(Comp)) p["label"] = f.label;
    return untrack(() => Comp(extend(p, {
      value: () => list()[i()]?.[f.name],
      options: () => (f.options ? schemaOptions(f) : undefined),
      readonly: () => ro() || !!f.readonly,
      disabled: () => !!props.disabled || !!f.disabled,
      onChange: () => (v: unknown) => edit(i.peek(), f.name, v),
    })));
  };

  const error = (i: Accessor<number>, f: SchemaField) => computed(() => {
    const row = list()[i()] ?? {};
    const v = row[f.name];
    const empty = v == null || v === "" || (Array.isArray(v) && !v.length);
    return empty && !f.required ? null : sch().validateField(f.name, v, row);
  });

  return h("div", { class: cx("hm-records", props.class), role: "group", "aria-labelledby": labelledBy(props) },
    h("ol", { class: "hm-records-items" }, h(For, { each: idx, children: (i: Accessor<number>) => h("li", { class: "hm-records-row" },
      h("div", { class: () => cx("hm-form-grid", `hm-cols-${cols()}`) }, sch().fields.filter((f) => !f.hidden && f.type !== "hidden").map((f) => {
        const on = computed(() => !f.when || f.when(list()[i()] ?? {}));
        const err = error(i, f);
        return () => (on() ? untrack(() => h(Field, { label: INLINE_LABEL.has(inputFor(f)!) ? null : f.label, required: f.required, compact: true, error: live(() => err()) }, control(f, i))) : null);
      })),
      () => (ro() || (props.sortable === false && props.removable === false) ? null : h(RowTools, rowToolsProps(rows, i, { sortable: props.sortable, removable: props.removable, class: "hm-records-tools" })))) })),
    () => (ro() ? null : h(Button, { class: "hm-records-add", disabled: full, onClick: () => set([...untrack(list), blank()]) }, () => props.addLabel ?? t`Add row`)));
}

registerInput("records", RecordListEditor);
