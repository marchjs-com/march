/// <reference path="../css.d.ts" />
// Shared helpers for the form controls: value model, field context, ids, number parsing, list keyboard navigation.
import { signal, computed, effect, untrack, useContext, provide, getOwner, reactive, type Signal } from "../core/reactive.ts";
import { locale } from "../core/i18n.ts";
import { cx, uid, on, debounce } from "../ui/util.ts";
import type { Field } from "../schema/index.ts";
import { colorAttr, type ColorToken } from "../theme/colors.ts";

export { cx, uid, on, debounce };

/** What <Field> provides to the control inside it. */
export interface FieldCtx {
  id: string;
  labelId?: string;
  invalid?: () => boolean;
  describedby?: () => string;
}

/** Context set by <Field>: { id, describedby(), invalid() } — controls pick their id / aria attributes from it. */
export const FieldContext: { id: symbol; defaultValue: FieldCtx | null } = { id: Symbol("hm.field"), defaultValue: null };

/** A class prop: the same as every ui component (strings, arrays, { name: bool }, accessors). */
export type { ClassProp } from "../core/util.ts";
import type { ClassProp } from "../core/util.ts";

/** Props every control understands (id / aria wiring, state, focus handlers). */
export interface CommonProps {
  id?: string | null | undefined;
  name?: string | undefined;
  class?: ClassProp;
  disabled?: boolean | null | undefined;
  readonly?: boolean | null | undefined;
  required?: boolean | null | undefined;
  invalid?: boolean | null | undefined;
  describedby?: string | null | undefined;
  labelledby?: string | null | undefined;
  "aria-label"?: string | null | undefined;
  ariaLabel?: string | null | undefined;
  onBlur?: ((e: FocusEvent) => void) | undefined;
  onFocus?: ((e: FocusEvent) => void) | undefined;
  /**
   * Theme color token for focus, selection, caret and checked states: "primary" (default), "info", "success", "warning",
   * "danger", "neutral", "brand-orange|blue|green|purple", "cat-1".."cat-8". Inherited from a <Form>/<Field>/group.
   */
  color?: ColorToken | undefined;
  /** The schema field (set when rendered by <Field>). */
  field?: Field | undefined;
}

/**
 * Value props of a control with value type `T`: `bind:value` (getter `value` + `setValue`), a signal as `value`,
 * a live `value` + `onChange`, or an uncontrolled initial `value`.
 */
export interface ControlProps<T> extends CommonProps {
  value?: T | Signal<T> | null | undefined;
  setValue?: ((v: T) => void) | undefined;
  onChange?: ((v: T) => void) | undefined;
}

/**
 * Two-way value model for a control. Works with `bind:value` (getter `value` + `setValue`), a signal passed as `value`,
 * a live `value` getter + `onChange`, or an uncontrolled initial `value`. Returns [get, set]; `set` also calls onChange(v).
 */
export function model<T>(props: object, def: T, name = "value"): [get: () => T, set: (v: T) => void] {
  const p = props as Record<string, unknown>;
  const d = Object.getOwnPropertyDescriptor(props, name);
  const raw: unknown = d && !d.get ? d.value : undefined;
  const sig = typeof raw === "function" && (raw as Partial<Signal<T>>).signal ? (raw as Signal<T>) : null;
  const local = d?.get || sig ? null : signal<T>(raw === undefined ? def : (raw as T), { equals: false });
  const setter = p[`set${name.charAt(0).toUpperCase()}${name.slice(1)}`] as ((v: T) => void) | undefined;
  const get = (): T => (sig ? sig() : local ? local() : (p[name] as T | null | undefined)) ?? def;
  const set = (v: T): void => {
    if (sig) sig.set(v); else if (local) local.set(v);
    setter?.(v);
    (p["onChange"] as ((v: T) => void) | undefined)?.(v);
  };
  return [get, set];
}

/** A props view with extra live (getter) props; the original descriptors (incl. bind:value getters) are kept. */
export function extend<P extends object>(props: P, getters: { [K in keyof P]?: () => P[K] }): P {
  // copies are configurable: JSX props may arrive as non-configurable getters, and an override must replace them
  const d = Object.getOwnPropertyDescriptors(props) as PropertyDescriptorMap;
  for (const k in d) d[k]!.configurable = true;
  const o = Object.defineProperties({}, d) as P;
  for (const k in getters) Object.defineProperty(o, k, { get: getters[k] as () => unknown, enumerable: true, configurable: true });
  return o;
}

/** Keep `el.value` in sync with `fn()` without touching it when equal (caret stays put). */
export function syncValue(el: { value: string }, fn: () => unknown): void {
  effect(() => { const s = String(fn() ?? ""); if (el.value !== s) el.value = s; });
}

/** Read a prop that may be a getter or a plain function accessor (signal / thunk). */
export const val = <T>(v: T | (() => T)): T => (typeof v === "function" && !v.length ? (v as () => T)() : (v as T));

/** `reactive()` typed as its value: a live prop for h(Component, { x: live(() => …) }) (becomes a getter). */
export const live = reactive as <T>(fn: () => T) => T;

/** Run `fn` inside its own child owner (context provided inside does not leak to siblings; disposed with the parent). */
export function scoped<T>(fn: () => T): T {
  return getOwner() ? computed(() => untrack(fn))() : fn();
}

/** Provide a context value in the current scope. */
export const provideField = (v: FieldCtx): void => provide(FieldContext, v);

/** Attributes `ctl()` puts on a control's main focusable element. */
export interface CtlAttrs {
  id: string | null | undefined;
  name: string | undefined;
  disabled: () => boolean;
  required: () => boolean;
  "aria-invalid": () => "true" | null;
  "aria-describedby": () => string | null;
  "aria-label": () => string | null;
  onBlur: ((e: FocusEvent) => void) | undefined;
  onFocus: ((e: FocusEvent) => void) | undefined;
  [attr: string]: unknown;
}

/** Common attributes of a control's main focusable element. */
export function ctl(props: CommonProps, extra: Record<string, unknown> = {}): CtlAttrs {
  const fc = useContext(FieldContext);
  return {
    id: props.id ?? fc?.id,
    name: props.name,
    disabled: () => !!props.disabled,
    required: () => !!props.required,
    "aria-invalid": () => (props.invalid ?? fc?.invalid?.() ? "true" : null),
    "aria-describedby": () => props.describedby ?? (fc?.describedby?.() || null),
    "aria-label": () => props["aria-label"] ?? props.ariaLabel ?? null,
    "data-hm-color": colorAttr(props.color),
    onBlur: props.onBlur,
    onFocus: props.onFocus,
    ...extra,
  };
}

/** Field context of the enclosing <Field> (or null). */
export const useField = (): FieldCtx | null => useContext(FieldContext);

/** Labelled-by id for group controls (radio, checkbox group, segmented). */
export const labelledBy = (props: CommonProps): string | null => props.labelledby ?? useField()?.labelId ?? null;

// ------------------------------------------------------------------ numbers
const sepCache = new Map<string | undefined, { dec: string; grp: string }>();
/** Decimal and group separators for a locale. */
export function separators(loc: string | undefined): { dec: string; grp: string } {
  let s = sepCache.get(loc);
  if (!s) {
    let dec = ".", grp = ",";
    try {
      for (const p of new Intl.NumberFormat(loc).formatToParts(12345.6)) { if (p.type === "decimal") dec = p.value; if (p.type === "group") grp = p.value; }
    } catch { /* unknown locale */ }
    sepCache.set(loc, (s = { dec, grp }));
  }
  return s;
}

/**
 * Parse a number typed by a person. Accepts decimal comma and decimal point, grouping, spaces and a leading sign.
 * Returns null for empty input, NaN for garbage. Ambiguous "1.234" / "1,234" follows the locale.
 */
export function parseNumber(text: unknown, loc: string = untrack(locale)): number | null {
  let s = String(text ?? "").trim().replace(/[\s  ']/g, "").replace(/^−/, "-");
  if (!s) return null;
  if (!/^[-+]?[\d.,]+$/.test(s)) return NaN;
  const { dec } = separators(loc);
  const hasC = s.includes(","), hasP = s.includes(".");
  let decimal: string | null = null;
  if (hasC && hasP) decimal = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
  else if (hasC || hasP) {
    const ch = hasC ? "," : ".";
    const parts = s.split(ch);
    if (parts.length > 2) decimal = null; // only grouping
    else if (ch === dec) decimal = ch;
    else decimal = parts[1]!.length === 3 && parts[0]!.replace(/^[-+]/, "").length > 0 ? null : ch;
  }
  const other = decimal === "," ? "." : decimal === "." ? "," : null;
  if (other) s = s.split(other).join("");
  else if (!decimal) s = s.replace(/[.,]/g, "");
  if (decimal === ",") s = s.replace(",", ".");
  if (s.endsWith(".")) s = s.slice(0, -1);
  const n = Number(s);
  return Number.isFinite(n) && s !== "" && s !== "-" && s !== "+" ? n : NaN;
}

/** Options of formatNumber(). */
export interface FormatNumberOptions { decimals?: number | undefined; minDecimals?: number | undefined; grouping?: boolean | undefined }

/** Format a number for an input (no grouping by default so it stays easy to edit). */
export function formatNumber(n: number | null | undefined, loc?: string, { decimals, minDecimals = 0, grouping = false }: FormatNumberOptions = {}): string {
  if (n == null || !Number.isFinite(n)) return "";
  try {
    return new Intl.NumberFormat(loc, { useGrouping: grouping, minimumFractionDigits: Math.min(minDecimals, decimals ?? 20), maximumFractionDigits: decimals ?? 10 }).format(n);
  } catch { return String(n); }
}

// ------------------------------------------------------------------ list navigation
export interface ListNavOptions {
  count: () => number;
  active: Signal<number>;
  onPick: (i: number) => void;
  onOpen?: () => void;
  isOpen?: () => boolean;
  loop?: boolean;
}

/**
 * Keyboard navigation over a virtual list (aria-activedescendant pattern).
 * `count()` items, `active` signal (index, -1 = none). Returns a keydown handler that returns true when it handled the key.
 */
export function listNav({ count, active, onPick, onOpen, isOpen = () => true, loop = true }: ListNavOptions): (e: KeyboardEvent) => boolean {
  return (e) => {
    const n = count();
    const k = e.key;
    if ((k === "ArrowDown" || k === "ArrowUp") && !isOpen()) { e.preventDefault(); onOpen?.(); return true; }
    if (!isOpen()) return false;
    let i = active.peek();
    if (k === "ArrowDown") i = i + 1 >= n ? (loop ? 0 : n - 1) : i + 1;
    else if (k === "ArrowUp") i = i <= 0 ? (loop ? n - 1 : 0) : i - 1;
    else if (k === "Home" && e.ctrlKey) i = 0;
    else if (k === "End" && e.ctrlKey) i = n - 1;
    else if (k === "PageDown") i = Math.min(n - 1, i + 10);
    else if (k === "PageUp") i = Math.max(0, i - 10);
    else if (k === "Enter" && i >= 0 && i < n) { e.preventDefault(); onPick(i); return true; }
    else return false;
    e.preventDefault();
    active.set(n ? i : -1);
    return true;
  };
}

/** Normalize text for matching: the one fold (core/text) — Turkish İ/ı, accents, ß/æ — same as Table, Nav, Palette. */
export { fold } from "../core/text.ts";

/** Equality for option values (primitives, or objects by JSON). Truthy when equal. */
export const same = (a: unknown, b: unknown): unknown => a === b || (a && b && typeof a === "object" && JSON.stringify(a) === JSON.stringify(b));

/** Options prop: values or `{ value, label, hint, disabled }` objects (or a function returning the list). */
export type OptionsProp = readonly unknown[] | (() => readonly unknown[]) | null | undefined;
/** A normalized option. */
export interface Option { value: unknown; label: string; hint?: unknown; disabled?: boolean; [k: string]: unknown }

/** Normalize an options prop into [{ value, label, hint, disabled }]. */
export function normOptions(o: OptionsProp): Option[] {
  const list = typeof o === "function" ? o() : o ?? [];
  return list.map((x): Option => (x && typeof x === "object" ? { ...(x as Option), label: (x as Partial<Option>).label ?? String((x as Option).value) } : { value: x, label: String(x) }));
}
