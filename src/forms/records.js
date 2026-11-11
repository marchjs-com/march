// RecordListEditor: edit an array of records (objects) with a sub-schema. Each row shows one compact labelled control per
// field; rows can be added, moved and removed. Registered as the `records` field type / control:
//
//   carriers: { type: "records", label: "Carriers", fields: { name: { type: "text", required: true }, url: "url" }, addLabel: "Add carrier" }
//
// Props: fields (schema spec object or a schema), blank (object or () => object for new rows), max, addLabel, readonly,
// disabled, removable (default true), sortable (default true), cols (fields per line, default = number of fields, max 6).
// Validation (schema type `records`): every row is validated with the sub-schema; the first problem is reported as
// "Row N: <field label>: <message>".
import { computed, untrack, reactive } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { For } from "../dom/flow.js";
import { t } from "../core/i18n.ts";
import { schema as makeSchema, fieldType, options as schemaOptions } from "../schema/index.js";
import { model, cx, labelledBy, extend } from "./util.js";
import { inputFor, registerInput, INLINE_LABEL } from "./registry.js";
import { Field } from "./form.js";

const SKIP = new Set(["name", "label", "type", "help", "when", "validate", "default", "column", "format", "hidden", "control", "props",
  "requiredMessage", "pattern", "patternMessage", "span", "readonly", "disabled", "options", "value", "minLength", "section", "variant", "fields", "blank"]);
const TEXTY = new Set(["text", "textarea", "password", "email", "url", "phone"]);

/** Sub-schema of a records field (cached on the spec object). */
const subSchema = (fields) => (fields && typeof fields.validate === "function" && fields.fields ? fields : makeSchema(fields ?? {}));
const cache = new WeakMap();
function schemaOf(f) {
  if (!f.fields) return makeSchema({});
  if (!cache.has(f.fields)) cache.set(f.fields, subSchema(f.fields));
  return cache.get(f.fields);
}

/** First problem in a list of records, or null. */
export function validateRecords(list, fields) {
  const s = subSchema(fields);
  for (let i = 0; i < (list ?? []).length; i++) {
    const r = s.validate(list[i] ?? {});
    if (!r.ok) {
      const [name, msg] = Object.entries(r.errors)[0];
      return t`Row ${i + 1}: ${s.field(name)?.label ?? name}: ${msg}`;
    }
  }
  return null;
}

fieldType("records", {
  coerce: (v, f) => (Array.isArray(v) ? v.map((r) => schemaOf(f ?? {}).parse({ ...(r ?? {}) })).map((r, i) => ({ ...v[i], ...r })) : []),
  empty: [],
  check: (v, f) => validateRecords(v, schemaOf(f)),
});

const iconBtn = (label, text, onClick, disabled) => h("button", { type: "button", class: "hm-icon-btn", "aria-label": label, title: label, onClick, disabled }, text);

export function RecordListEditor(props) {
  const [get, set] = model(props, []);
  const list = () => get() ?? [];
  const sch = computed(() => subSchema(props.fields));
  const idx = computed(() => list().map((_, i) => i), { equals: (a, b) => a?.length === b?.length });
  const ro = () => !!(props.disabled || props.readonly);
  const full = () => props.max != null && list().length >= props.max;
  const blank = () => { const b = typeof props.blank === "function" ? props.blank() : props.blank; return { ...untrack(() => sch().defaults()), ...(b ?? {}) }; };
  const edit = (i, name, v) => { const cur = [...untrack(list)]; cur[i] = { ...cur[i], [name]: v }; set(cur); };
  const move = (i, d) => { const cur = [...untrack(list)]; const j = i + d; if (j < 0 || j >= cur.length) return; [cur[i], cur[j]] = [cur[j], cur[i]]; set(cur); };
  const cols = () => Math.min(6, Math.max(1, props.cols ?? sch().fields.filter((f) => !f.hidden && f.type !== "hidden").length));

  const control = (f, i) => {
    const Comp = inputFor(f);
    if (!Comp) return null;
    const p = {};
    for (const k of Object.keys(f)) if (!SKIP.has(k)) p[k] = f[k];
    if (TEXTY.has(f.type)) { delete p.min; delete p.max; if (f.type === "text" && f.max != null) p.maxLength = f.maxLength ?? f.max; }
    Object.assign(p, f.props ?? {});
    if (INLINE_LABEL.has(Comp)) p.label = f.label;
    return untrack(() => Comp(extend(p, {
      value: () => list()[i()]?.[f.name],
      options: () => (f.options ? schemaOptions(f) : undefined),
      readonly: () => ro() || !!f.readonly,
      disabled: () => !!props.disabled || !!f.disabled,
      onChange: () => (v) => edit(i.peek(), f.name, v),
    })));
  };

  const error = (i, f) => computed(() => {
    const row = list()[i()] ?? {};
    const v = row[f.name];
    const empty = v == null || v === "" || (Array.isArray(v) && !v.length);
    return empty && !f.required ? null : sch().validateField(f.name, v, row);
  });

  return h("div", { class: cx("hm-records", props.class), role: "group", "aria-labelledby": labelledBy(props) },
    h("ol", { class: "hm-records-items" }, h(For, { each: idx }, (i) => h("li", { class: "hm-records-row" },
      h("div", { class: () => cx("hm-form-grid", `hm-cols-${cols()}`) }, sch().fields.filter((f) => !f.hidden && f.type !== "hidden").map((f) => {
        const on = computed(() => !f.when || f.when(list()[i()] ?? {}));
        const err = error(i, f);
        return () => (on() ? untrack(() => h(Field, { label: INLINE_LABEL.has(inputFor(f)) ? null : f.label, required: f.required, compact: true, error: reactive(() => err()) }, control(f, i))) : null);
      })),
      () => (ro() ? null : h("div", { class: "hm-records-tools" },
        props.sortable === false ? null : [
          iconBtn(t`Move up`, "↑", () => move(i.peek(), -1), () => i() === 0),
          iconBtn(t`Move down`, "↓", () => move(i.peek(), 1), () => i() === list().length - 1),
        ],
        props.removable === false ? null : iconBtn(t`Remove`, "×", () => set(untrack(list).filter((_, j) => j !== i.peek())))))))),
    () => (ro() ? null : h("button", { type: "button", class: "hm-btn hm-records-add", disabled: () => full(), onClick: () => set([...untrack(list), blank()]) },
      () => props.addLabel ?? t`Add row`)));
}

registerInput("records", RecordListEditor);
