// JSON values as trees: paths, immutable updates and a small JSON Schema subset validator. Shared by TreeEditor and
// JsonEditor (which shows the same messages in its text view).
import { t, messages } from "../../../core/i18n.ts";
import tr from "./tr.ts";

messages("tr", tr);

export type JsonPath = readonly (string | number)[];
export type JsonType = "string" | "number" | "integer" | "boolean" | "null" | "object" | "array";

/** "/a/0/b~1c" (RFC 6901 JSON pointer) for a path; "" is the root. */
export const pointer = (p: JsonPath): string => p.map((k) => `/${String(k).replace(/~/g, "~0").replace(/\//g, "~1")}`).join("");

/** The type a value shows as (integers are "number"). */
export const typeOf = (v: unknown): Exclude<JsonType, "integer"> =>
  v === null ? "null" : Array.isArray(v) ? "array" : typeof v === "object" ? "object" : typeof v === "number" ? "number" : typeof v === "boolean" ? "boolean" : "string";

/** Value at a path (array of keys / indexes) inside a JSON value, or undefined. */
export const getAt = (root: unknown, p: JsonPath): unknown => p.reduce<unknown>((v, k) => (v != null && typeof v === "object" ? (v as Record<string | number, unknown>)[k] : undefined), root);

/** A copy of `root` with `fn(old)` at `p` (only the containers on the way are copied). */
export function updateAt(root: unknown, p: JsonPath, fn: (old: unknown) => unknown): unknown {
  if (!p.length) return fn(root);
  const [k, ...rest] = p;
  if (Array.isArray(root)) { const c = root.slice(); c[k as number] = updateAt(root[k as number], rest, fn); return c; }
  const o = { ...(root as Record<string, unknown>) };
  o[k as string] = updateAt(o[k as string], rest, fn);
  return o;
}

/** Remove the entry at `p`. */
export function removeAt(root: unknown, p: JsonPath): unknown {
  const parent = p.slice(0, -1), k = p[p.length - 1]!;
  return updateAt(root, parent, (c) => {
    if (Array.isArray(c)) return c.filter((_, i) => i !== k);
    const { [k as string]: _gone, ...rest } = c as Record<string, unknown>;
    return rest;
  });
}

/** Rename an object key in place (the order of the keys is kept). */
export function renameAt(root: unknown, p: JsonPath, to: string): unknown {
  const parent = p.slice(0, -1), from = p[p.length - 1] as string;
  return updateAt(root, parent, (c) => Object.fromEntries(Object.entries(c as Record<string, unknown>).map(([k, v]) => [k === from ? to : k, v])));
}

/** Insert `value` after `p` (in an array) or after key `p` with `key` (in an object). */
export function insertAfter(root: unknown, p: JsonPath, value: unknown, key?: string): unknown {
  const parent = p.slice(0, -1), at = p[p.length - 1]!;
  return updateAt(root, parent, (c) => {
    if (Array.isArray(c)) { const n = c.slice(); n.splice((at as number) + 1, 0, value); return n; }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(c as Record<string, unknown>)) { out[k] = v; if (k === at) out[key!] = value; }
    return out;
  });
}

/** A key not used in `obj`: base, base2, base3 … */
export function freeKey(obj: Record<string, unknown>, base = "key"): string {
  if (!(base in obj)) return base;
  let i = 2;
  while (`${base}${i}` in obj) i++;
  return `${base}${i}`;
}

/** Convert a value to another type, keeping what can be kept. */
export function convert(v: unknown, to: Exclude<JsonType, "integer">): unknown {
  const from = typeOf(v);
  if (from === to) return v;
  switch (to) {
    case "string": return from === "object" || from === "array" ? JSON.stringify(v) : v === null ? "" : String(v);
    case "number": { const n = typeof v === "string" ? Number(v.replace(",", ".")) : typeof v === "boolean" ? Number(v) : NaN; return Number.isFinite(n) ? n : 0; }
    case "boolean": return typeof v === "string" ? /^(true|1|yes|evet|on)$/i.test(v.trim()) : !!v && (typeof v !== "object" || Object.keys(v as object).length > 0);
    case "null": return null;
    case "array": return from === "object" ? Object.values(v as object) : v === null || v === "" ? [] : [v];
    case "object": return from === "array" ? Object.fromEntries((v as unknown[]).map((x, i) => [String(i), x])) : v === null || v === "" ? {} : { value: v };
  }
}

/** The JSON Schema subset TreeEditor and JsonEditor check. */
export interface JsonSchema {
  type?: JsonType | readonly JsonType[];
  properties?: Readonly<Record<string, JsonSchema>>;
  required?: readonly string[];
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;
  enum?: readonly unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: "email" | "uri" | "date" | "date-time";
  /** Shown as the row's hint in TreeEditor. */
  description?: string;
}
export interface JsonError { path: JsonPath; message: string }

const FORMAT: Record<string, RegExp> = { email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, uri: /^[a-z][a-z0-9+.-]*:\S+$/i, date: /^\d{4}-\d{2}-\d{2}$/, "date-time": /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/ };
const TYPE_NAME = (x: JsonType): string => ({ string: t`text`, number: t`number`, integer: t`whole number`, boolean: t`true / false`, null: t`empty`, object: t`object`, array: t`list` })[x];

/** Check `value` against `schema`; every problem with its path. */
export function validateJson(value: unknown, schema: JsonSchema | undefined, path: JsonPath = []): JsonError[] {
  if (!schema) return [];
  const out: JsonError[] = [];
  const err = (message: string, p: JsonPath = path): void => { out.push({ path: p, message }); };
  const types = schema.type == null ? null : Array.isArray(schema.type) ? (schema.type as JsonType[]) : [schema.type as JsonType];
  const kind = typeOf(value);
  if (types && !types.some((x) => x === kind || (x === "integer" && kind === "number" && Number.isInteger(value)) || (x === "number" && kind === "number"))) {
    err(t`Expected ${types.map(TYPE_NAME).join(" / ")}`);
    return out;
  }
  if (schema.enum && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) err(t`Must be one of: ${schema.enum.map((e) => JSON.stringify(e)).join(", ")}`);
  if (kind === "number") {
    const n = value as number;
    if (schema.minimum != null && n < schema.minimum) err(t`At least ${schema.minimum}`);
    if (schema.maximum != null && n > schema.maximum) err(t`At most ${schema.maximum}`);
  }
  if (kind === "string") {
    const s = value as string;
    if (schema.minLength != null && s.length < schema.minLength) err(schema.minLength === 1 ? t`Cannot be empty` : t`At least ${schema.minLength} characters`);
    if (schema.maxLength != null && s.length > schema.maxLength) err(t`At most ${schema.maxLength} characters`);
    if (schema.pattern && !safeTest(schema.pattern, s)) err(t`Does not match the expected pattern`);
    if (schema.format && FORMAT[schema.format] && !FORMAT[schema.format]!.test(s)) err(t`Not a valid ${schema.format}`);
  }
  if (kind === "array") {
    const a = value as unknown[];
    if (schema.minItems != null && a.length < schema.minItems) err(t`At least ${schema.minItems} items`);
    if (schema.maxItems != null && a.length > schema.maxItems) err(t`At most ${schema.maxItems} items`);
    if (schema.items) a.forEach((x, i) => out.push(...validateJson(x, schema.items, [...path, i])));
  }
  if (kind === "object") {
    const o = value as Record<string, unknown>;
    for (const r of schema.required ?? []) if (!(r in o)) err(t`Missing required field "${r}"`);
    for (const [k, v] of Object.entries(o)) {
      const sub = schema.properties?.[k];
      if (sub) out.push(...validateJson(v, sub, [...path, k]));
      else if (schema.additionalProperties === false) err(t`Field not allowed here`, [...path, k]);
      else if (typeof schema.additionalProperties === "object") out.push(...validateJson(v, schema.additionalProperties, [...path, k]));
    }
  }
  return out;
}
const safeTest = (pattern: string, s: string): boolean => { try { return new RegExp(pattern, "u").test(s); } catch { return true; } };

/** The schema that applies at `p` (for hints and enum pickers). */
export function schemaAt(schema: JsonSchema | undefined, p: JsonPath): JsonSchema | undefined {
  let s = schema;
  for (const k of p) {
    if (!s) return undefined;
    s = typeof k === "number" ? s.items : s.properties?.[k] ?? (typeof s.additionalProperties === "object" ? s.additionalProperties : undefined);
  }
  return s;
}
