// HADI March schema: describe a record once; get validation, coercion, defaults, form fields and table columns.
//
//   const Product = schema({
//     title: { type: "text", required: true, max: 80 },
//     price: { type: "money", currency: "USD", min: 0 },
//     status: { type: "pick", options: ["draft", "live"], default: "draft" },
//     tags: "list",
//   })
//   Product.validate(values) → { ok, errors: { price: "Must be at least 0" }, values }
//   Product.columns()  Product.defaults()  Product.pick("title", "price")
import { t } from "../core/i18n.ts";

/** Field types and their base behaviour. Extend with `fieldType(name, def)`. */
export const TYPES = {
  text: { coerce: (v) => (v == null ? "" : String(v)), empty: "" },
  textarea: { coerce: (v) => (v == null ? "" : String(v)), empty: "" },
  password: { coerce: (v) => (v == null ? "" : String(v)), empty: "", hidden: true },
  email: { coerce: (v) => (v == null ? "" : String(v).trim()), empty: "", check: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : t`Enter a valid email address`) },
  url: { coerce: (v) => (v == null ? "" : String(v).trim()), empty: "", check: (v, f) => (/^https:\/\/[^\s]+$/.test(v) || (!f.httpsOnly && /^http:\/\/[^\s]+$/.test(v)) ? null : t`Enter a valid https:// address`) },
  phone: { coerce: (v) => (v == null ? "" : String(v).replace(/[^\d+]/g, "")), empty: "", check: (v) => (/^\+?[0-9]{7,15}$/.test(v) ? null : t`Enter a valid phone number`) },
  number: { coerce: num, empty: null },
  int: { coerce: (v) => { const n = num(v); return n == null ? null : Math.trunc(n); }, empty: null, check: (v) => (Number.isInteger(v) ? null : t`Enter a whole number`) },
  money: { coerce: num, empty: null, format: (f) => ["money", f.currency ?? "USD"] },
  percent: { coerce: num, empty: null, format: () => ["percent", 1] },
  bool: { coerce: (v) => v === true || v === "true" || v === "on" || v === 1, empty: false },
  date: { coerce: dateStr, empty: null, format: () => "date" },
  datetime: { coerce: (v) => (v == null || v === "" ? null : new Date(v).toISOString()), empty: null, format: () => "datetime" },
  time: { coerce: (v) => (v == null ? "" : String(v)), empty: "", check: (v) => (/^\d{2}:\d{2}$/.test(v) ? null : t`Use HH:MM`) },
  pick: { coerce: (v) => v, empty: null, check: (v, f) => (options(f).some((o) => o.value === v) ? null : t`Choose one of the options`) },
  multi: { coerce: (v) => (Array.isArray(v) ? v : v == null || v === "" ? [] : [v]), empty: [], check: (v, f) => (v.every((x) => options(f).some((o) => o.value === x)) ? null : t`Choose from the options`) },
  list: { coerce: (v) => (Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : String(v ?? "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean)), empty: [] },
  json: { coerce: (v) => { if (typeof v !== "string") return v; if (!v.trim()) return null; try { return JSON.parse(v); } catch { return { __invalid: v }; } }, empty: null, check: (v) => (v && v.__invalid !== undefined ? t`Invalid JSON` : null) },
  color: { coerce: (v) => (v == null ? "" : String(v)), empty: "", check: (v) => (/^#[0-9a-f]{6}$/i.test(v) ? null : t`Use a #RRGGBB color`) },
  file: { coerce: (v) => v ?? null, empty: null },
  hidden: { coerce: (v) => v, empty: null },
};
function num(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(/\s/g, "");
  // "1.234,50" / "12,5" (decimal comma) and "1,234.50" / "12.5" (decimal point)
  const n = Number(/,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
}
function dateStr(v) {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d) ? "invalid" : d.toISOString().slice(0, 10);
}
/** Normalize `options` into [{ value, label }]. */
export function options(f) {
  const o = typeof f.options === "function" ? f.options() : f.options ?? [];
  return o.map((x) => (x && typeof x === "object" ? { value: x.value, label: x.label ?? String(x.value), hint: x.hint } : { value: x, label: String(x) }));
}

/** Register a custom field type: `fieldType("iban", { coerce, check, empty })`. */
export function fieldType(name, def) { TYPES[name] = { coerce: (v) => v, empty: null, ...def }; }

const titleCase = (k) => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());

function normalize(name, spec) {
  const f = typeof spec === "string" ? { type: spec } : { ...spec };
  f.type ??= "text";
  if (!TYPES[f.type]) throw new Error(`March schema: unknown field type "${f.type}" for "${name}". Known: ${Object.keys(TYPES).join(", ")}`);
  f.name = name;
  f.label ??= titleCase(name);
  return f;
}

/**
 * Create a schema.
 * Field options: type, label, required, min, max (number value or text length), minLength, maxLength, pattern (RegExp),
 * options (pick/multi), default, help, placeholder, readonly, hidden, column (false | column overrides), format,
 * currency, validate(value, values) → message|null, when(values) → bool (conditional field).
 */
export function schema(spec, opts = {}) {
  const fields = Object.entries(spec).map(([k, v]) => normalize(k, v));
  const byName = Object.fromEntries(fields.map((f) => [f.name, f]));
  const active = (f, values) => !f.when || f.when(values ?? {});

  const s = {
    fields,
    field: (name) => byName[name],
    names: () => fields.map((f) => f.name),
    defaults() {
      const o = {};
      for (const f of fields) o[f.name] = typeof f.default === "function" ? f.default() : f.default ?? structuredCloneSafe(TYPES[f.type].empty);
      return o;
    },
    /** Coerce raw input values to typed values (unknown keys dropped). */
    parse(values = {}) {
      const o = {};
      for (const f of fields) if (f.name in values) o[f.name] = TYPES[f.type].coerce(values[f.name], f);
      return o;
    },
    /** Message for one field or null. */
    validateField(name, value, values = {}) {
      const f = byName[name];
      if (!f || !active(f, values) || f.readonly) return null;
      const v = TYPES[f.type].coerce(value, f);
      const empty = v == null || v === "" || (Array.isArray(v) && !v.length);
      if (empty) return f.required ? (f.requiredMessage ?? t`This field is required`) : null;
      if (typeof v === "number" && Number.isNaN(v)) return t`Enter a number`;
      if (v === "invalid" && (f.type === "date")) return t`Enter a valid date`;
      const msg = TYPES[f.type].check?.(v, f);
      if (msg) return msg;
      const len = typeof v === "string" || Array.isArray(v) ? v.length : null;
      const isNum = typeof v === "number";
      if (f.min != null && isNum && v < f.min) return t`Must be at least ${f.min}`;
      if (f.max != null && isNum && v > f.max) return t`Must be at most ${f.max}`;
      const minL = f.minLength ?? (!isNum ? f.min : null), maxL = f.maxLength ?? (!isNum ? f.max : null);
      if (minL != null && len != null && len < minL) return t`Must be at least ${minL} characters`;
      if (maxL != null && len != null && len > maxL) return t`Must be at most ${maxL} characters`;
      if (f.pattern && typeof v === "string" && !f.pattern.test(v)) return f.patternMessage ?? t`Invalid format`;
      return f.validate?.(v, values) ?? null;
    },
    /** Validate all active fields. */
    validate(values = {}) {
      const errors = {};
      for (const f of fields) {
        const m = s.validateField(f.name, values[f.name], values);
        if (m) errors[f.name] = m;
      }
      const extra = opts.validate?.(s.parse(values));
      if (extra) Object.assign(errors, extra);
      return { ok: !Object.keys(errors).length, errors, values: s.parse(values) };
    },
    /** Columns for <Table>: key, label, format, sortable, filter type, align. */
    columns(over = {}) {
      return fields.filter((f) => f.column !== false && !f.hidden && f.type !== "password" && f.type !== "hidden").map((f) => ({
        key: f.name, label: f.label, type: f.type,
        format: f.format ?? TYPES[f.type].format?.(f),
        sortable: !["json", "list", "multi", "file"].includes(f.type),
        filter: filterOf(f),
        options: f.options ? options(f) : undefined,
        align: ["number", "int", "money", "percent"].includes(f.type) ? "end" : "start",
        ...(typeof f.column === "object" ? f.column : {}),
        ...(over[f.name] ?? {}),
      }));
    },
    pick: (...names) => schema(Object.fromEntries(fields.filter((f) => names.includes(f.name)).map((f) => [f.name, f])), opts),
    omit: (...names) => schema(Object.fromEntries(fields.filter((f) => !names.includes(f.name)).map((f) => [f.name, f])), opts),
    extend: (more) => schema({ ...Object.fromEntries(fields.map((f) => [f.name, f])), ...more }, opts),
    isActive: (name, values) => active(byName[name], values),
  };
  return s;
}

function filterOf(f) {
  if (["number", "int", "money", "percent"].includes(f.type)) return "range";
  if (["date", "datetime"].includes(f.type)) return "dateRange";
  if (f.type === "bool") return "bool";
  if (f.type === "pick" || f.type === "multi") return "select";
  if (["json", "file", "list"].includes(f.type)) return null;
  return "text";
}
function structuredCloneSafe(v) { return Array.isArray(v) ? [...v] : v && typeof v === "object" ? { ...v } : v; }
