// Shared helpers for the form controls: value model, field context, ids, number parsing, list keyboard navigation.
import { signal, computed, effect, untrack, useContext, provide, getOwner } from "../core/reactive.js";
import { locale } from "../core/i18n.ts";
import { cx, uid, on, debounce } from "../ui/util.js";

export { cx, uid, on, debounce };

/** Context set by <Field>: { id, describedby(), invalid() } — controls pick their id / aria attributes from it. */
export const FieldContext = { id: Symbol("hm.field"), defaultValue: null };

/**
 * Two-way value model for a control. Works with `bind:value` (getter `value` + `setValue`), a signal passed as `value`,
 * a live `value` getter + `onChange`, or an uncontrolled initial `value`. Returns [get, set]; `set` also calls onChange(v).
 */
export function model(props, def, name = "value") {
  const d = Object.getOwnPropertyDescriptor(props, name);
  const raw = d && !d.get ? d.value : undefined;
  const sig = typeof raw === "function" && raw.signal ? raw : null;
  const local = d?.get || sig ? null : signal(raw === undefined ? def : raw, { equals: false });
  const setter = props[`set${name[0].toUpperCase()}${name.slice(1)}`];
  const get = () => (sig ? sig() : local ? local() : props[name]) ?? def;
  const set = (v) => {
    if (sig) sig.set(v); else if (local) local.set(v);
    setter?.(v);
    props.onChange?.(v);
  };
  return [get, set];
}

/** A props view with extra live (getter) props; the original descriptors (incl. bind:value getters) are kept. */
export function extend(props, getters) {
  const o = Object.defineProperties({}, Object.getOwnPropertyDescriptors(props));
  for (const k in getters) Object.defineProperty(o, k, { get: getters[k], enumerable: true, configurable: true });
  return o;
}

/** Keep `el.value` in sync with `fn()` without touching it when equal (caret stays put). */
export function syncValue(el, fn) {
  effect(() => { const s = String(fn() ?? ""); if (el.value !== s) el.value = s; });
}

/** Read a prop that may be a getter or a plain function accessor (signal / thunk). */
export const val = (v) => (typeof v === "function" && !v.length ? v() : v);

/** Run `fn` inside its own child owner (context provided inside does not leak to siblings; disposed with the parent). */
export function scoped(fn) {
  return getOwner() ? computed(() => untrack(fn))() : fn();
}

/** Provide a context value in the current scope. */
export const provideField = (v) => provide(FieldContext, v);

/** Common attributes of a control's main focusable element. */
export function ctl(props, extra = {}) {
  const fc = useContext(FieldContext);
  return {
    id: props.id ?? fc?.id,
    name: props.name,
    disabled: () => !!props.disabled,
    required: () => !!props.required,
    "aria-invalid": () => (props.invalid ?? fc?.invalid?.() ? "true" : null),
    "aria-describedby": () => props.describedby ?? (fc?.describedby?.() || null),
    "aria-label": () => props["aria-label"] ?? props.ariaLabel ?? null,
    onBlur: props.onBlur,
    onFocus: props.onFocus,
    ...extra,
  };
}

/** Field context of the enclosing <Field> (or null). */
export const useField = () => useContext(FieldContext);

/** Labelled-by id for group controls (radio, checkbox group, segmented). */
export const labelledBy = (props) => props.labelledby ?? useField()?.labelId ?? null;

// ------------------------------------------------------------------ numbers
const sepCache = new Map();
/** Decimal and group separators for a locale. */
export function separators(loc) {
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
export function parseNumber(text, loc = untrack(locale)) {
  let s = String(text ?? "").trim().replace(/[\s  ']/g, "").replace(/^−/, "-");
  if (!s) return null;
  if (!/^[-+]?[\d.,]+$/.test(s)) return NaN;
  const { dec } = separators(loc);
  const hasC = s.includes(","), hasP = s.includes(".");
  let decimal = null;
  if (hasC && hasP) decimal = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
  else if (hasC || hasP) {
    const ch = hasC ? "," : ".";
    const parts = s.split(ch);
    if (parts.length > 2) decimal = null; // only grouping
    else if (ch === dec) decimal = ch;
    else decimal = parts[1].length === 3 && parts[0].replace(/^[-+]/, "").length > 0 ? null : ch;
  }
  const other = decimal === "," ? "." : decimal === "." ? "," : null;
  if (other) s = s.split(other).join("");
  else if (!decimal) s = s.replace(/[.,]/g, "");
  if (decimal === ",") s = s.replace(",", ".");
  if (s.endsWith(".")) s = s.slice(0, -1);
  const n = Number(s);
  return Number.isFinite(n) && s !== "" && s !== "-" && s !== "+" ? n : NaN;
}

/** Format a number for an input (no grouping by default so it stays easy to edit). */
export function formatNumber(n, loc, { decimals, minDecimals = 0, grouping = false } = {}) {
  if (n == null || !Number.isFinite(n)) return "";
  try {
    return new Intl.NumberFormat(loc, { useGrouping: grouping, minimumFractionDigits: Math.min(minDecimals, decimals ?? 20), maximumFractionDigits: decimals ?? 10 }).format(n);
  } catch { return String(n); }
}

// ------------------------------------------------------------------ list navigation
/**
 * Keyboard navigation over a virtual list (aria-activedescendant pattern).
 * `count()` items, `active` signal (index, -1 = none). Returns a keydown handler that returns true when it handled the key.
 */
export function listNav({ count, active, onPick, onOpen, isOpen = () => true, loop = true }) {
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

/** Normalize text for matching (case and accent insensitive). */
export const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase();

/** Equality for option values (primitives, or objects by JSON). */
export const same = (a, b) => a === b || (a && b && typeof a === "object" && JSON.stringify(a) === JSON.stringify(b));

/** Normalize an options prop into [{ value, label, hint, disabled }]. */
export function normOptions(o) {
  const list = typeof o === "function" ? o() : o ?? [];
  return list.map((x) => (x && typeof x === "object" ? { ...x, label: x.label ?? String(x.value) } : { value: x, label: String(x) }));
}
