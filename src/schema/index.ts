// HADI March schema: describe a record once; get validation, coercion, defaults, form fields and table columns.
//
//   const Product = schema({
//     title: { type: "text", required: true, max: 80 },
//     price: { type: "money", currency: "USD", min: 0 },
//     status: { type: "pick", options: ["draft", "live"] as const, default: "draft" },
//     tags: "list",
//   })
//   Product.validate(values) → { ok, errors: { price: "Must be at least 0" }, values }
//   Product.columns()  Product.defaults()  Product.pick("title", "price")
//   type ProductValues = Infer<typeof Product>   // { title: string; price: number | null; status: "draft" | "live" | null; tags: string[] }
import { t } from "../core/i18n.ts";

/** Built-in field type names. */
export type FieldTypeName = "text" | "textarea" | "password" | "email" | "url" | "phone" | "number" | "int" | "money" | "percent" | "bool"
  | "date" | "datetime" | "time" | "pick" | "multi" | "list" | "json" | "color" | "file" | "hidden";
/** A field type name: built-in or registered with `fieldType()`. */
export type FieldTypeRef = FieldTypeName | (string & {});
export type Values = Record<string, unknown>;
/** A message, or null/undefined when valid. */
export type Message = string | null | undefined;

/** Field options. Unknown extra keys are kept (custom field types and editors read them). */
export interface FieldSpec {
  type?: FieldTypeRef;
  label?: string;
  required?: boolean;
  requiredMessage?: string;
  /** Number value, or text/list length for non-numeric fields. */
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  patternMessage?: string;
  /** pick/multi options: values or `{ value, label, hint }`; may be a function. */
  options?: readonly unknown[] | (() => readonly unknown[]);
  default?: unknown;
  help?: string;
  placeholder?: string;
  readonly?: boolean;
  hidden?: boolean;
  /** `false` hides the column; an object overrides column settings. */
  column?: false | Readonly<Record<string, unknown>>;
  format?: unknown;
  currency?: string;
  /** url: reject http:// addresses. */
  httpsOnly?: boolean;
  validate?: (value: never, values: Values) => Message;
  /** Conditional field: only active (validated) when this returns true. */
  when?: (values: Values) => unknown;
  [option: string]: unknown;
}
/** A spec: field name → options, or just a type name (`tags: "list"`). */
export type SchemaSpec = { readonly [name: string]: FieldSpec | FieldTypeRef };
/** A normalized field (spec + name, label and type filled in). */
export type Field = FieldSpec & { type: FieldTypeRef; name: string; label: string };
export interface FieldOption { value: unknown; label: string; hint?: unknown }

/** Behaviour of a field type. */
export interface FieldTypeDef {
  /** Raw input → typed value. */
  coerce: (value: unknown, field: Field) => unknown;
  /** Default empty value. */
  empty: unknown;
  /** Type-specific check of a non-empty coerced value → message or null. */
  check?: (value: never, field: Field) => Message;
  /** Table/display format (pipe name or [pipe, ...args]). */
  format?: (field: Field) => unknown;
  hidden?: boolean;
}

// ---- value types -------------------------------------------------------------------------------------------------
type StringTypes = "text" | "textarea" | "password" | "email" | "url" | "phone" | "time" | "color";
type NumberTypes = "number" | "int" | "money" | "percent";
type TypeOfSpec<F> = F extends string ? F : F extends { readonly type: infer T extends string } ? T : "text";
type OptionValue<F> = F extends { readonly options: readonly (infer O)[] } ? (O extends { readonly value: infer V } ? V : O) : string;
type BaseValue<T extends string, F> =
  [T] extends [StringTypes] ? string
  : [T] extends [NumberTypes] ? number | null
  : [T] extends ["bool"] ? boolean
  : [T] extends ["date" | "datetime"] ? string | null
  : [T] extends ["pick"] ? OptionValue<F> | null
  : [T] extends ["multi" | "list"] ? string[]
  : [T] extends ["file"] ? File | null
  : unknown; // json, hidden, custom types
/** Value type of one field spec (`required: true` removes `| null`). */
export type FieldValue<F> = F extends { readonly required: true } ? Exclude<BaseValue<TypeOfSpec<F>, F>, null> : BaseValue<TypeOfSpec<F>, F>;
/** Value type of a schema or a spec: `type Product = Infer<typeof Product>`. */
export type Infer<S> = S extends Schema<infer V> ? V : { -readonly [K in keyof S]: FieldValue<S[K]> };

export interface Column {
  key: string;
  label: string;
  type: FieldTypeRef;
  format: unknown;
  sortable: boolean;
  filter: "range" | "dateRange" | "bool" | "select" | "text" | null;
  options: FieldOption[] | undefined;
  align: "start" | "end";
  [option: string]: unknown;
}
export interface ValidationResult<V> { ok: boolean; errors: Record<string, string>; values: Partial<V> }
export interface SchemaOptions<V> {
  /** Whole-record validation: returns extra errors by field name. */
  validate?: (values: Partial<V>) => Record<string, string> | null | undefined | void;
}

/** A schema over records of type `V`. */
export interface Schema<V = Values> {
  fields: Field[];
  field(name: string): Field | undefined;
  names(): string[];
  defaults(): V;
  /** Coerce raw input values to typed values (unknown keys dropped). */
  parse(values?: Values): Partial<V>;
  /** Message for one field or null. */
  validateField(name: string, value: unknown, values?: Values): string | null;
  /** Validate all active fields. */
  validate(values?: Values): ValidationResult<V>;
  /** Columns for <Table>: key, label, format, sortable, filter type, align. */
  columns(over?: Record<string, Record<string, unknown>>): Column[];
  pick<K extends keyof V & string>(...names: K[]): Schema<Pick<V, K>>;
  omit<K extends keyof V & string>(...names: K[]): Schema<Omit<V, K>>;
  extend<S extends SchemaSpec>(more: S): Schema<Omit<V, keyof S> & Infer<S>>;
  isActive(name: string, values?: Values): boolean;
}

const str = (v: unknown): string => (v == null ? "" : String(v));
/** Field types and their base behaviour. Extend with `fieldType(name, def)`. */
export const TYPES: Record<string, FieldTypeDef> = {
  text: { coerce: str, empty: "" },
  textarea: { coerce: str, empty: "" },
  password: { coerce: str, empty: "", hidden: true },
  email: { coerce: (v) => (v == null ? "" : String(v).trim()), empty: "", check: (v: string) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : t`Enter a valid email address`) },
  url: { coerce: (v) => (v == null ? "" : String(v).trim()), empty: "", check: (v: string, f) => (/^https:\/\/[^\s]+$/.test(v) || (!f.httpsOnly && /^http:\/\/[^\s]+$/.test(v)) ? null : t`Enter a valid https:// address`) },
  phone: { coerce: (v) => (v == null ? "" : String(v).replace(/[^\d+]/g, "")), empty: "", check: (v: string) => (/^\+?[0-9]{7,15}$/.test(v) ? null : t`Enter a valid phone number`) },
  number: { coerce: num, empty: null },
  int: { coerce: (v) => { const n = num(v); return n == null ? null : Math.trunc(n); }, empty: null, check: (v: unknown) => (Number.isInteger(v) ? null : t`Enter a whole number`) },
  money: { coerce: num, empty: null, format: (f) => ["money", f.currency ?? "USD"] },
  percent: { coerce: num, empty: null, format: () => ["percent", 1] },
  bool: { coerce: (v) => v === true || v === "true" || v === "on" || v === 1, empty: false },
  date: { coerce: dateStr, empty: null, format: () => "date" },
  datetime: { coerce: (v) => (v == null || v === "" ? null : new Date(v as string).toISOString()), empty: null, format: () => "datetime" },
  time: { coerce: str, empty: "", check: (v: string) => (/^\d{2}:\d{2}$/.test(v) ? null : t`Use HH:MM`) },
  pick: { coerce: (v) => v, empty: null, check: (v: unknown, f) => (options(f).some((o) => o.value === v) ? null : t`Choose one of the options`) },
  multi: { coerce: (v) => (Array.isArray(v) ? v : v == null || v === "" ? [] : [v]), empty: [], check: (v: unknown[], f) => (v.every((x) => options(f).some((o) => o.value === x)) ? null : t`Choose from the options`) },
  list: { coerce: (v) => (Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : String(v ?? "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean)), empty: [] },
  json: { coerce: (v) => { if (typeof v !== "string") return v; if (!v.trim()) return null; try { return JSON.parse(v) as unknown; } catch { return { __invalid: v }; } }, empty: null, check: (v: { __invalid?: unknown } | null) => (v && v.__invalid !== undefined ? t`Invalid JSON` : null) },
  color: { coerce: str, empty: "", check: (v: string) => (/^#[0-9a-f]{6}$/i.test(v) ? null : t`Use a #RRGGBB color`) },
  file: { coerce: (v) => v ?? null, empty: null },
  hidden: { coerce: (v) => v, empty: null },
};
function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(/\s/g, "");
  // "1.234,50" / "12,5" (decimal comma) and "1,234.50" / "12.5" (decimal point)
  const n = Number(/,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
}
function dateStr(v: unknown): string | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v as string);
  return isNaN(d.getTime()) ? "invalid" : d.toISOString().slice(0, 10);
}
/** Normalize `options` into [{ value, label }]. */
export function options(f: { options?: FieldSpec["options"] }): FieldOption[] {
  const o = typeof f.options === "function" ? f.options() : f.options ?? [];
  return o.map((x): FieldOption => {
    if (x && typeof x === "object") { const y = x as { value?: unknown; label?: unknown; hint?: unknown }; return { value: y.value, label: (y.label ?? String(y.value)) as string, hint: y.hint }; }
    return { value: x, label: String(x) };
  });
}

/** Register a custom field type: `fieldType("iban", { coerce, check, empty })`. */
export function fieldType(name: string, def: Partial<FieldTypeDef>): void { TYPES[name] = { coerce: (v) => v, empty: null, ...def }; }

const typeDef = (f: Field): FieldTypeDef => TYPES[f.type] as FieldTypeDef;
const titleCase = (k: string): string => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());

function normalize(name: string, spec: FieldSpec | string): Field {
  const f = (typeof spec === "string" ? { type: spec } : { ...spec }) as Field;
  f.type ??= "text";
  if (!TYPES[f.type]) throw new Error(`March schema: unknown field type "${f.type}" for "${name}". Known: ${Object.keys(TYPES).join(", ")}`);
  f.name = name;
  f.label ??= titleCase(name);
  return f;
}

/**
 * Create a schema. The value type is inferred from the spec (`Infer<typeof S>`); declare pick `options` `as const` to
 * get a literal union.
 * Field options: type, label, required, min, max (number value or text length), minLength, maxLength, pattern (RegExp),
 * options (pick/multi), default, help, placeholder, readonly, hidden, column (false | column overrides), format,
 * currency, validate(value, values) → message|null, when(values) → bool (conditional field).
 */
export function schema<S extends SchemaSpec>(spec: S, opts?: SchemaOptions<Infer<S>>): Schema<Infer<S>>;
export function schema(spec: SchemaSpec, opts: SchemaOptions<Values> = {}): Schema<Values> {
  const fields = Object.entries(spec).map(([k, v]) => normalize(k, v));
  const byName: Record<string, Field> = Object.fromEntries(fields.map((f) => [f.name, f]));
  const active = (f: Field | undefined, values: Values | undefined): boolean => !(f as Field).when || !!(f as Field).when?.(values ?? {});
  const fromFields = (fs: Field[]): SchemaSpec => Object.fromEntries(fs.map((f) => [f.name, f]));

  const s: Schema<Values> = {
    fields,
    field: (name) => byName[name],
    names: () => fields.map((f) => f.name),
    defaults() {
      const o: Values = {};
      for (const f of fields) o[f.name] = typeof f.default === "function" ? (f.default as () => unknown)() : f.default ?? structuredCloneSafe(typeDef(f).empty);
      return o;
    },
    parse(values = {}) {
      const o: Values = {};
      for (const f of fields) if (f.name in values) o[f.name] = typeDef(f).coerce(values[f.name], f);
      return o;
    },
    validateField(name, value, values = {}) {
      const f = byName[name];
      if (!f || !active(f, values) || f.readonly) return null;
      const v = typeDef(f).coerce(value, f);
      const empty = v == null || v === "" || (Array.isArray(v) && !v.length);
      if (empty) return f.required ? (f.requiredMessage ?? t`This field is required`) : null;
      if (typeof v === "number" && Number.isNaN(v)) return t`Enter a number`;
      if (v === "invalid" && (f.type === "date")) return t`Enter a valid date`;
      const msg = (typeDef(f).check as ((v: unknown, f: Field) => Message) | undefined)?.(v, f);
      if (msg) return msg;
      const len = typeof v === "string" || Array.isArray(v) ? v.length : null;
      const isNum = typeof v === "number";
      if (f.min != null && isNum && v < f.min) return t`Must be at least ${f.min}`;
      if (f.max != null && isNum && v > f.max) return t`Must be at most ${f.max}`;
      const minL = f.minLength ?? (!isNum ? f.min : null), maxL = f.maxLength ?? (!isNum ? f.max : null);
      if (minL != null && len != null && len < minL) return t`Must be at least ${minL} characters`;
      if (maxL != null && len != null && len > maxL) return t`Must be at most ${maxL} characters`;
      if (f.pattern && typeof v === "string" && !f.pattern.test(v)) return f.patternMessage ?? t`Invalid format`;
      return (f.validate as ((v: unknown, values: Values) => Message) | undefined)?.(v, values) ?? null;
    },
    validate(values = {}) {
      const errors: Record<string, string> = {};
      for (const f of fields) {
        const m = s.validateField(f.name, values[f.name], values);
        if (m) errors[f.name] = m;
      }
      const extra = opts.validate?.(s.parse(values));
      if (extra) Object.assign(errors, extra);
      return { ok: !Object.keys(errors).length, errors, values: s.parse(values) };
    },
    columns(over = {}) {
      return fields.filter((f) => f.column !== false && !f.hidden && f.type !== "password" && f.type !== "hidden").map((f): Column => ({
        key: f.name, label: f.label, type: f.type,
        format: f.format ?? typeDef(f).format?.(f),
        sortable: !["json", "list", "multi", "file"].includes(f.type),
        filter: filterOf(f),
        options: f.options ? options(f) : undefined,
        align: ["number", "int", "money", "percent"].includes(f.type) ? "end" : "start",
        ...(typeof f.column === "object" ? f.column : {}),
        ...(over[f.name] ?? {}),
      }));
    },
    pick: (...names) => schema(fromFields(fields.filter((f) => (names as string[]).includes(f.name))), opts) as Schema<never>,
    omit: (...names) => schema(fromFields(fields.filter((f) => !(names as string[]).includes(f.name))), opts) as Schema<never>,
    extend: (more) => schema({ ...fromFields(fields), ...more }, opts) as Schema<never>,
    isActive: (name, values) => active(byName[name], values),
  };
  return s;
}

function filterOf(f: Field): Column["filter"] {
  if (["number", "int", "money", "percent"].includes(f.type)) return "range";
  if (["date", "datetime"].includes(f.type)) return "dateRange";
  if (f.type === "bool") return "bool";
  if (f.type === "pick" || f.type === "multi") return "select";
  if (["json", "file", "list"].includes(f.type)) return null;
  return "text";
}
function structuredCloneSafe(v: unknown): unknown { return Array.isArray(v) ? [...v] : v && typeof v === "object" ? { ...v } : v; }
